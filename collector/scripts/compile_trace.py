from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


COLLECTOR_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(COLLECTOR_ROOT / "src"))

from inference_trace.compiler import compile_trace  # noqa: E402


REQUIRED_STAGES = {
    "run.environment",
    "model.config",
    "model.weight_shards",
    "vllm_ascend.worker.model_runner_v1.NPUModelRunner.load_model.start",
    "vllm_ascend.worker.model_runner_v1.NPUModelRunner.load_model.end",
    "vllm_ascend.worker.model_runner_v1.NPUModelRunner.initialize_kv_cache.start",
    "vllm_ascend.worker.model_runner_v1.NPUModelRunner.execute_model.start",
    "tensor.embedding",
    "tensor.linear_attention.layer0",
    "tensor.full_attention.qkv_projection.layer3",
    "tensor.full_attention.qkv.layer3",
    "tensor.full_attention.output.layer3",
    "tensor.moe.router.layer3",
    "tensor.moe.experts.layer3",
    "parallel.topology",
    "parallel.module_shard",
    "parallel.span.layer3.moe_experts.start",
    "parallel.span.layer3.moe_experts.end",
    "tensor.full_attention.o_projection.layer3",
    "tensor.moe.routing.layer3",
    "tensor.moe.dispatch.layer3",
    "tensor.moe.gmm1_swiglu_input.layer3",
    "tensor.moe.gmm1_swiglu_output.layer3",
    "tensor.moe.gmm2_input.layer3",
    "tensor.moe.gmm2_output.layer3",
    "tensor.moe.combine.layer3",
    "tensor.logits",
    "run.output",
}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("raw_dir", type=Path)
    parser.add_argument("output_dir", type=Path)
    args = parser.parse_args()
    report = compile_trace(
        args.raw_dir,
        args.output_dir,
        required_stages=REQUIRED_STAGES,
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if not report["errors"] and not report["missingStages"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
