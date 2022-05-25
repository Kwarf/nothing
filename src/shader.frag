#version 420

layout(std140, binding = 0)
uniform Uniforms
{
	vec3 resolution;
	float time;
};

layout(location = 0) out vec4 fragColor;

#include "glsl/hg_sdf.glsl"

const float BPM = 174.0;
float beat() { return time / (60.0 / BPM); }
float barHit() { float i; return 1.0 - modf(beat() / 4.0, i); }
float beatHit() { float i; return 1.0 - modf(beat(), i); }

float opUnion(float a, float b) { return min(a, b); }
float opSubtraction(float a, float b) { return max(-a, b); }
float opIntersection(float a, float b) { return max(a, b); }

float sdTriPrism(vec3 p, vec2 h)
{
	vec3 q = abs(p);
	return max(q.z-h.y,max(q.x*0.866025+p.y*0.5,-p.y)-h.x*0.5);
}

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
#define MAX_DIST 100.

float rand(vec2 co)
{
	return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

FieldResult frMin(FieldResult a, FieldResult b)
{
	return a.distance < b.distance ? a : b;
}

FieldResult tunnel(in vec3 p)
{
	vec3 pa = p - vec3(0, 0, -time * 10.0); pMod1(pa.z, 4);
	float a = opSubtraction(sdTriPrism(pa, vec2(6, 2))
		, sdTriPrism(pa, vec2(10, 1))
	);

	vec3 pb = p - vec3(0, 0, 2 + -time * 10.0); pMod1(pb.z, 4);
	pR(pb.xy, radians(60.0));
	float b = opSubtraction(sdTriPrism(pb, vec2(10, 2))
		, sdTriPrism(pb, vec2(14, 0.99))
	);

	return frMin(FieldResult(a, 10), FieldResult(b, 11));
}

FieldResult tunnelWonky(in vec3 p)
{
	float bt = beat() * 64.0;

	vec3 pa = p - vec3(0, 0, -time * 10.0); pMod1(pa.z, 4);
	pR(pa.xy, radians(-bt));
	float a = opSubtraction(sdTriPrism(pa, vec2(10, 2))
		, sdTriPrism(pa, vec2(12, 1))
	);

	vec3 pb = p - vec3(0, 0, 2 + -time * 10.0); pMod1(pb.z, 4);
	pR(pb.xy, radians(60.0 + bt));
	float b = opSubtraction(sdTriPrism(pb, vec2(10, 2))
		, sdTriPrism(pb, vec2(12, 0.99))
	);

	return frMin(FieldResult(a, 10), FieldResult(b, 11));
}

FieldResult sphere(in vec3 p)
{
	float displace = sin(2*p.x)*sin(2*p.y)*sin(2*p.z)*sin(beat()/4.0);
	return FieldResult(fSphere(p - vec3(0, 0, 5), 0.1 + (0.3 * barHit())) + displace, 1);
}

FieldResult sphereAngry(in vec3 p)
{
	float displace = rand(vec2(time, sin(p.x) / 1000000.0)) * 0.2;
	return FieldResult(fSphere(p - vec3(0, 0, 5), 2.0 + displace), 1);
}

FieldResult sphereWorbling(in vec3 p)
{
	float displace = rand(vec2(time, sin(p.x) / 1000000.0)) * 0.2;
	float b = beat();
	if (b >= 100) { pR(p.xy, radians(-60.0)); }
	else if (b >= 92) { pR(p.xy, radians(60.0)); }
	return FieldResult(fSphere(p - vec3(0, 0, 5), 2.0) + (sin(1.0 + (p.y * 2.5) - b * 8.0)) * 0.5, 1);
}

FieldResult metaballs(in vec3 p)
{
	float bt = beat() * 2.0;
	float st = sin(bt);
	float ct = cos(bt);

	p.z -= 5.0;
	pR(p.xy, st);
	pR(p.xz, ct*0.5);
	float a = fSphere(p - vec3(st, ct, -ct), 1.0);
	float b = fSphere(p - vec3(ct, st, -st), 1.0);
	float c = fSphere(p - vec3(-st, -ct, st), 1.0);

	float r = fOpUnionRound(a, b, 0.6);
	r = fOpUnionRound(r, c, 0.6);

	return FieldResult(r, 1);
}

FieldResult scene(vec3 p)
{
	float b = beat();
	if (b > 144.0)
	{
		return tunnel(p);
	}

	FieldResult s;
	if (b >= 108.0 && b < 112.0
	 || b >= 116.0 && b < 120.0
	 || b >= 124.0 && b < 128.0
	 || b >= 132.0 && b < 136.0
	 || b >= 140.0
	 )
	{
		s = metaballs(p);
	}
	else if (b >= 80.0 && b < 144.0)
	{
		if (b >= 84.0 && b < 88.0
		 || b >= 92.0 && b < 96.0
		 || b >= 100.0 && b < 104.0
		 )
		{
			s = sphereWorbling(p);
		}
		else
		{
			s = sphereAngry(p);
		}
	}
	else
	{
		s = sphere(p);
	}

	FieldResult t;
	if (b < 116.0
	 || b >= 120.0 && b < 124.0
	 || b >= 128.0 && b < 132.0
	 || b >= 136.0 && b < 140.0
	 || b >= 144.0
	 )
	{
		t = tunnel(p);
	}
	else
	{
		t = tunnelWonky(p);
	}


	return frMin(s, t);
}

Hit march(vec3 ro, vec3 rd)
{
	float dist = 0;
	FieldResult field = FieldResult(0, 0);
	for (int i = 0; i < MAX_STEPS; i++)
	{
		field = scene(ro + rd * dist);
		if(abs(field.distance) < .00001 || dist > MAX_DIST)
		{
			break;
		}
		dist += field.distance * 0.75;
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
		case 10: // Tunnel color 1
			return vec3(0.03);
		case 11: // Tunnel color 2
			return vec3(1.0, 0.0, 0.0);
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
		case 10:
			return true;
		case 11:
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
	return mix(color, vec3(0.02), fog);
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
	float b = beat();
	vec3 lightPosition = vec3(-1, 0, -1);
	vec3 cameraPosition = vec3(0, 0, -1);
	if (b < 80.0)
	{
		// cameraPosition = vec3(sin((b + 1.7) / 2.0) * 2.0, 0, sin(b / 4.0) * 5.0);
		cameraPosition = vec3(sin((b - 4.6) / 4.0) * 2.0, 0, -1 + sin(b / 8.0) * 10.0);
	}
	vec3 lookAt = vec3(0, 0, 5);

	vec2 uv = (2.0 * (gl_FragCoord.xy / resolution.xy - 0.5)) * vec2(resolution.x / resolution.y, -1.0);
	vec3 rayDirection = getCameraRayDir(uv, cameraPosition, lookAt);

	Hit hit = march(cameraPosition, rayDirection);
	vec3 N = calcNormal(position(hit));
	vec3 color = render(hit, N, lightPosition);
	vec3 pOutside = position(hit) + N * .0015;
	float shadow = calcShadow(pOutside, lightPosition, 16.);

	if (isMaterialReflective(hit.materialId) && hit.distance < 30.0)
	{
		hit = march(pOutside, reflect(rayDirection, N));
		N = calcNormal(position(hit));
		color += render(hit, N, lightPosition) * .35;
	}

	color *= shadow;
	fragColor = vec4(clamp(color, 0., 1.), 1);
	if (b < 4.0) { fragColor = mix(vec4(0), fragColor, (b / 4.0) * 0.2); }
	if (b > 144.0) { fragColor = mix(fragColor, vec4(0), ((b - 144.0) / 8.0)); }
}
