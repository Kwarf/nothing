#version 420

layout(std140, binding = 0)
uniform Uniforms
{
	vec3 resolution;
	float time;
};

layout(location = 0) out vec4 fragColor;

#include "glsl/hg_sdf.glsl"

vec3 rgb(int r, int g, int b)
{
	return vec3(float(r) / 255., float(g) / 255., float(b) / 255.);
}

struct FieldResult
{
	float distance;
	int materialId;
};

struct Hit
{
	vec3 origin;
	vec3 direction;
	float distance;
	int materialId;
};

vec3 position(Hit hit)
{
	return hit.origin + hit.direction * hit.distance;
}

#define MAX_STEPS 96
#define MAX_SHADOW_ITER 24
#define MAX_DIST 30.

FieldResult frMin(FieldResult a, FieldResult b)
{
	return a.distance < b.distance ? a : b;
}

FieldResult scene(vec3 p)
{
	float displace = sin(2*p.x)*sin(2*p.y)*sin(2*p.z)*sin(time);
	FieldResult sphere = FieldResult(fSphere(p - vec3(0, 0, 10), 3.0) + displace, 1);
	FieldResult sphere2 = FieldResult(fSphere(p - vec3(5, 0, 10), 3.0) + displace, 10);

	return frMin(sphere, sphere2);
}

Hit march(vec3 ro, vec3 rd)
{
	float dist = 0;
	FieldResult field = FieldResult(0, 0);
	for (int i = 0; i < MAX_STEPS; i++)
	{
		field = scene(ro + rd * dist);
		if(abs(field.distance) < .001 || dist>MAX_DIST)
		{
			break;
		}
		dist += field.distance * .75;
	}
	return Hit(ro, rd, dist, field.materialId);
}

float calcShadow(vec3 ro, vec3 lp, float k)
{
	vec3 rd = lp - ro;
	float shade = 1.;
	float dist = .002;
	float end = max(length(rd), .001);
	rd /= end;
	for (int i = 0; i < MAX_SHADOW_ITER; i++)
	{
		float h = scene(ro + rd * dist).distance;
		shade = min(shade, smoothstep(0., 1., k * h / dist));
		dist += clamp(h, .02, .25);
		if (h < .0001 || dist > end)
		{
			break;
		}
	}
	return min(max(shade, 0.) + .1, 1);
}

vec3 calcNormal(in vec3 pos)
{
	vec2 e = vec2(.001, 0);
	return normalize(vec3(
		scene(pos + e.xyy).distance,
		scene(pos + e.yxy).distance,
		scene(pos + e.yyx).distance
	) - scene(pos).distance);
}

vec3 getMaterialColor(Hit hit)
{
	switch (hit.materialId)
	{
		case 1: // Reflective gold
			return rgb(255, 223, 0);
		case 10:
			return vec3(0.1);
		default:
			return vec3(0);
	}
}

bool isMaterialReflective(int materialId)
{
	switch (materialId)
	{
		case 1:
			return true;
		default:
			return false;
	}
}

vec3 render(in Hit hit, in vec3 N, in vec3 lp)
{
	vec3 ld = lp - position(hit);
	float lDist = max(length(ld), .001);
	ld /= lDist;

	const float lRadius = 20.;
	float atten = clamp(1.0 - lDist * lDist / (lRadius * lRadius), 0.0, 1.0);
	atten *= atten;
	float diff = max(dot(N, ld), 0.);
	float spec = pow(max(dot(reflect(-ld, N), -hit.direction), 0), 8.);
	vec3 color = (getMaterialColor(hit) * (diff + .15) + vec3(1., .6, .2) * spec * 2.) * atten;

	float fog = smoothstep(0., .95, hit.distance / MAX_DIST);
	return mix(color, vec3(0.01), fog);
}

vec3 getCameraRayDir(vec2 uv, vec3 cameraPosition, vec3 lookAt)
{
	vec3 forward = normalize(lookAt - cameraPosition);
	vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), forward));
	vec3 up = normalize(cross(forward, right));
	return normalize(uv.x * right + uv.y * up + forward * 2.0);
}

void main()
{
	vec3 lightPosition = vec3(-1, 0, -1);
	vec3 cameraPosition = vec3(0, 0, -1);
	vec3 lookAt = vec3(0, 0, 0);

	vec2 uv = (2.0 * (gl_FragCoord.xy / resolution.xy - 0.5)) * vec2(resolution.x / resolution.y, -1.0);
	vec3 rayDirection = getCameraRayDir(uv, cameraPosition, lookAt);

	Hit hit = march(cameraPosition, rayDirection);
	vec3 N = calcNormal(position(hit));
	vec3 color = render(hit, N, lightPosition);
	vec3 pOutside = position(hit) + N * .0015;
	float shadow = calcShadow(pOutside, lightPosition, 16.);

	if (isMaterialReflective(hit.materialId))
	{
		hit = march(pOutside, reflect(rayDirection, N));
		N = calcNormal(position(hit));
		color += render(hit, N, lightPosition) * .35;
	}

	color *= shadow;
	fragColor = vec4(clamp(color, 0., 1.), 1);
}
