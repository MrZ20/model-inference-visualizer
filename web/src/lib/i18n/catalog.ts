import type { Locale } from '$lib/playback/engine';

const en = {
  title: 'Inside Qwen3.5 Inference', subtitle: 'One real Ascend NPU trace, explained step by step', real: 'REAL TRACE', derived: 'DERIVED',
  overview: 'Overview', init: 'Load & initialize', tokens: 'Tokens to tensors', prefill: 'Prefill', attention: 'Fused attention', moe: 'Mixture of experts', tp: 'Tensor parallel', decode: 'Decode',
  play: 'Play trace', pause: 'Pause trace', previous: 'Previous', next: 'Next', evidence: 'Evidence', language: '中文', close: 'Close',
  heroKicker: 'FROM TEXT TO THE NEXT TOKEN', heroTitle: 'Follow one inference through the machine', heroBody: 'Scroll through the complete path, then click any highlighted stage to unfold its tensors, operators, and evidence.',
  prompt: 'Prompt', output: 'Generated continuation', model: 'Model', execution: 'Execution',
  initKicker: '01 · INITIALIZATION', initTitle: 'Weights become runnable NPU state', initBody: 'Metadata resolves first. Quantized parameters are then sharded across two tensor-parallel ranks and loaded into NPU memory.',
  metadata: 'Resolve metadata', shard: 'Shard weights', quant: 'Load W8A8 weights', runtime: 'Prepare runtime', layers: '40 layers', experts: '256 experts', ready: 'Ready',
  tokenKicker: '02 · INPUT', tokenTitle: 'Text becomes a matrix', tokenBody: 'The tokenizer maps text pieces to integer IDs. Embedding lookup turns five IDs into five 2,048-dimensional vectors.', tokenIds: 'Token IDs', embedding: 'Embedding matrix', shape: 'Shape',
  prefillKicker: '03 · PREFILL', prefillTitle: 'Five positions enter the first layer', prefillBody: 'RMSNorm stabilizes each vector. The fused QKV projection creates local query, key, and value tensors.', hidden: 'Hidden states', norm: 'RMSNorm', qkv: 'Fused QKV projection',
  attentionKicker: '04 · ATTENTION', attentionTitle: 'Each token chooses what came before', attentionBody: 'The production kernel is fused. For teaching, the causal softmax matrix is reconstructed offline and verified against captured tensors.', expandAttention: 'Explore attention internals', causalMask: 'Causal mask', softmax: 'Softmax probability', verified: 'Cosine similarity > 0.9999988',
  moeKicker: '05 · MIXTURE OF EXPERTS', moeTitle: 'The router activates a sparse path', moeBody: 'A router scores 256 experts per token. Only selected experts execute, keeping capacity high while reducing work.', router: 'Router logits', selected: 'Selected experts', dispatch: 'Token dispatch', combine: 'Weighted combine', expandMoe: 'Explore routing',
  tpKicker: '06 · PARALLELISM', tpTitle: 'One logical layer, two synchronized ranks', tpBody: 'Tensor parallelism splits projection weights and local outputs across two NPU workers, then collective communication restores the logical result.', rank0: 'Rank 0', rank1: 'Rank 1', collective: 'Collective communication', expandTp: 'Explore tensor parallelism', epOff: 'Expert parallelism is disabled',
  decodeKicker: '07 · DECODE', decodeTitle: 'One token returns, then the loop continues', decodeBody: 'The final state projects to 248,320 logits. Sampling picks the next token, updates the KV cache, and repeats five times.', logits: 'Logits', sample: 'Sample', kv: 'Update KV cache', finalText: 'Final text',
  traceEvidence: 'Trace evidence', captured: 'Captured on Ascend NPU', runId: 'Run ID', provenance: 'Provenance', loading: 'Loading real trace…', error: 'Trace unavailable', retry: 'Retry',
  scroll: 'Scroll to begin', openDetail: 'Open details', weightShard: 'Weight shard', localOutput: 'Local output', expertLoad: 'Expert load', probability: 'Probability',
  layersOverview: '40-layer architecture', fullAttention: 'Full attention', linearAttention: 'Linear attention', tensorInspector: 'Tensor inspector', glossary: 'Glossary', dtype: 'Data type', device: 'Device', semantics: 'Meaning', scheduler: 'Scheduler: 1 request · 5 prompt tokens · execution padded to 8'
} as const;
export type MessageKey = keyof typeof en;

const zh: Record<MessageKey, string> = {
  title: '深入 Qwen3.5 推理', subtitle: '逐步拆解一次真实的昇腾 NPU 推理轨迹', real: '真实采集', derived: '离线推导',
  overview: '总览', init: '加载与初始化', tokens: 'Token 到张量', prefill: '预填充', attention: '融合注意力', moe: '混合专家', tp: '张量并行', decode: '逐词生成',
  play: '播放轨迹', pause: '暂停轨迹', previous: '上一步', next: '下一步', evidence: '数据证据', language: 'EN', close: '关闭',
  heroKicker: '从文本到下一个 TOKEN', heroTitle: '跟随一次推理穿过整台机器', heroBody: '向下滚动查看完整路径，点击高亮阶段即可展开它的张量、算子与采集证据。',
  prompt: '输入文本', output: '生成内容', model: '模型', execution: '执行环境',
  initKicker: '01 · 初始化', initTitle: '权重变成可运行的 NPU 状态', initBody: '先解析模型元数据，再将量化参数切分到两个张量并行 Rank 并加载到 NPU 内存。',
  metadata: '解析元数据', shard: '切分权重', quant: '加载 W8A8 权重', runtime: '准备运行时', layers: '40 层', experts: '256 个专家', ready: '就绪',
  tokenKicker: '02 · 输入', tokenTitle: '文本变成矩阵', tokenBody: '分词器把文本片段映射成整数 ID，Embedding 查表再把五个 ID 变成五个 2,048 维向量。', tokenIds: 'Token ID', embedding: 'Embedding 矩阵', shape: '形状',
  prefillKicker: '03 · PREFILL', prefillTitle: '五个位置进入第一层', prefillBody: 'RMSNorm 稳定每个向量，融合 QKV 投影生成本地 Query、Key 与 Value 张量。', hidden: '隐藏状态', norm: 'RMSNorm', qkv: '融合 QKV 投影',
  attentionKicker: '04 · 注意力', attentionTitle: '每个 Token 选择前文信息', attentionBody: '生产内核会融合整个操作。为了教学，我们离线重建因果 Softmax 矩阵并用采集张量验证。', expandAttention: '展开注意力内部', causalMask: '因果遮罩', softmax: 'Softmax 概率', verified: '余弦相似度 > 0.9999988',
  moeKicker: '05 · 混合专家', moeTitle: '路由器激活稀疏计算路径', moeBody: '路由器为每个 Token 计算 256 个专家分数，只有被选中的专家执行，在减少计算的同时保留容量。', router: '路由分数', selected: '选中专家', dispatch: 'Token 分发', combine: '加权合并', expandMoe: '展开专家路由',
  tpKicker: '06 · 并行', tpTitle: '一个逻辑层，两个同步 Rank', tpBody: '张量并行把投影权重与本地输出分给两个 NPU Worker，再用集合通信恢复逻辑结果。', rank0: 'Rank 0', rank1: 'Rank 1', collective: '集合通信', expandTp: '展开张量并行', epOff: '专家并行未启用',
  decodeKicker: '07 · DECODE', decodeTitle: '返回一个 Token，然后继续循环', decodeBody: '最终状态投影为 248,320 个 Logit。采样选出下一个 Token，更新 KV Cache，并重复五次。', logits: 'Logits', sample: '采样', kv: '更新 KV Cache', finalText: '最终文本',
  traceEvidence: '轨迹证据', captured: '采集自昇腾 NPU', runId: '运行 ID', provenance: '数据来源', loading: '正在加载真实轨迹…', error: '轨迹加载失败', retry: '重试',
  scroll: '向下滚动开始', openDetail: '打开详情', weightShard: '权重分片', localOutput: '本地输出', expertLoad: '专家负载', probability: '概率',
  layersOverview: '40 层结构', fullAttention: '全注意力', linearAttention: '线性注意力', tensorInspector: '张量检查器', glossary: '术语表', dtype: '数据类型', device: '设备', semantics: '含义', scheduler: '调度器：1 个请求 · 5 个 Prompt Token · 执行补齐到 8'
};

export const messages: Record<Locale, Record<MessageKey, string>> = { en, zh };
export const createCatalog = (locale: Locale) => (key: MessageKey) => messages[locale][key];
