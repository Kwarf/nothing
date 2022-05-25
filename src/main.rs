use usch::{
    DemoBuilder,
};

#[repr(C)]
#[derive(Copy, Clone, Debug, bytemuck::Pod, bytemuck::Zeroable)]
struct Uniforms {
    resolution: [f32; 3],
    time: f32,
}

static RESOLUTION: (u32, u32) = (1280, 720);

fn main() {
    #[cfg(feature = "editor")]
    let tracker = usch::sync::Tracker::new(174
        , None
        , &[]
    );

    #[cfg(feature = "editor")]
    DemoBuilder::new(RESOLUTION, "Birdie 2022")
        .with_tracker(tracker)
        // .with_ogg_music(include_bytes!("music.ogg"), Some(743006))
        .scene(|builder| {
            builder
                .with_uniforms(|time| {
                    bytemuck::bytes_of(&Uniforms {
                        resolution: [RESOLUTION.0 as f32, RESOLUTION.1 as f32, 0f32],
                        time: time.elapsed().as_secs_f32(),
                    })
                    .to_vec()
                })
                .add_glsl_include_path("src")
                .set_fragment_source(include_str!("shader.frag"))
                .watch_fragment_source(std::path::Path::new("src/shader.frag"))
                .build()
        })
        .build()
        .run();

    #[cfg(not(feature = "editor"))]
    DemoBuilder::new(RESOLUTION, "Birdie 2022")
        // .with_ogg_music(include_bytes!("music.ogg"), Some(743006))
        .scene(|builder| {
            builder
                .with_uniforms(|time| {
                    bytemuck::bytes_of(&Uniforms {
                        resolution: [RESOLUTION.0 as f32, RESOLUTION.1 as f32, 0f32],
                        time: time.elapsed().as_secs_f32(),
                    })
                    .to_vec()
                })
                .set_fragment_source(include_str!("shader.wgsl"))
                .build()
        })
        .build()
        .run();
}
