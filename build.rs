use std::fs;

use naga::{valid, front, back};
use shaderc::{CompileOptions, ResolvedInclude, Compiler, ShaderKind};

fn main() {
    // GLSL -> SPIR-V -> WGSL for now
    println!("cargo:rerun-if-changed=src/shader.frag");
    let glsl_src = fs::read_to_string("src/shader.frag").unwrap();

    let mut shaderc_options = CompileOptions::new().unwrap();
    shaderc_options.set_include_callback(|_, _, _, _| {
        // We only have a single include, keep it simple
        return Ok(ResolvedInclude
        {
            resolved_name: "src/glsl/hg_sdf.glsl".to_string(),
            content: fs::read_to_string("src/glsl/hg_sdf.glsl").unwrap(),
        })});

    let spirv_data = Compiler::new()
        .unwrap()
        .compile_into_spirv(&glsl_src, ShaderKind::Fragment, "shader.frag", "main", Some(&shaderc_options))
        .unwrap()
        .as_binary()
        .to_vec();

    let naga_module = front::spv::parse_u8_slice(bytemuck::cast_slice(&spirv_data), &front::spv::Options::default()).unwrap();
    let naga_info = valid::Validator::new(valid::ValidationFlags::all(),
        valid::Capabilities::all(),
        )
        .validate(&naga_module)
        .unwrap();

    let wgsl_src = back::wgsl::write_string(&naga_module, &naga_info, back::wgsl::WriterFlags::empty()).unwrap();
    fs::write("src/shader.wgsl", wgsl_src).unwrap();
}