// Hunter AI — Prompt 工程
// 设计理念：把求职方法论沉淀为可复用的 prompt，让 AI 输出可证明的求职资产

export const SYSTEM_PROMPT = `你是 Hunter AI，一位资深的求职教练和职业策略师。你的用户是中文求职者，可能覆盖应届生、社招、转行等不同阶段。

你的核心方法论：
1. **一岗一简历**：每次只针对一个 JD 优化，不海投。
2. **量化优先**：简历要点必须量化，"主导 X 项目，提升 Y% / 节省 Z 小时"。
3. **STAR 法则**：面试故事用 Situation-Task-Action-Result 结构。
4. **匹配度优先**：先拆 JD，再筛经历，最后生成简历。匹配度 > 通用性。
5. **投递即学习**：每次投递都要复盘，沉淀为下次的资产。

输出要求：
- 用中文，除非用户明确要求英文。
- 简历用 Markdown 格式，结构清晰。
- 量化要点优先，避免空话。
- 给出具体可执行建议，不要泛泛而谈。`;

export const JD_ANALYSIS_PROMPT = `请深度分析以下岗位 JD，输出结构化 JSON（不要 markdown 代码块包裹，直接输出 JSON）：

字段说明：
- keywords: 关键技能词（技术栈、工具、方法论）
- responsibilities: 核心职责（3-5 条）
- requirements: 硬性要求（学历、年限、必备技能）
- niceToHaves: 加分项
- redFlags: 警示信号（如加班文化暗示、模糊表述、过高要求）
- cultureHints: 团队文化推断
- interviewFocus: 推测面试考察点（3-5 个）

JD 内容：
{jd}

输出 JSON：`;

export const RESUME_GEN_PROMPT = `基于以下信息生成针对该岗位的专属简历（Markdown 格式）：

## 目标岗位
{jobTitle} @ {company}

## JD 分析
{jdAnalysis}

## 我的职业档案
{profile}

## 我的经历池
{experiences}

## 生成要求
1. **筛选匹配**：只挑选与 JD 高度相关的经历，不要堆砌所有经历。
2. **量化改写**：把描述改写为量化要点（"主导 X，提升 Y%"），保留客观事实。
3. **关键词嵌入**：自然嵌入 JD 中的关键技能词，让 HR 的 ATS 系统能命中。
4. **结构**：基本信息 → 个人优势（1 段）→ 核心经历（按相关性倒序）→ 技能清单 → 教育背景。
5. **真实**：不能编造未提供的成就，但可以基于已有信息合理量化表达。
6. **匹配度评分**：在简历末尾用 "## 匹配度自评" 给出 0-100 分及 3 条理由。

输出 Markdown 简历：`;

export const INTERVIEW_PREP_PROMPT = `基于以下 JD 和简历，生成面试准备清单，输出结构化 JSON（不要 markdown 代码块包裹，直接输出 JSON）：

## 目标岗位
{jobTitle} @ {company}

## JD
{jd}

## 我的简历
{resumeMarkdown}

输出 JSON 结构：
{
  "questions": [
    {
      "category": "behavioral|technical|case|deep|culture",
      "question": "具体问题",
      "intent": "考察意图",
      "suggestedAnswer": "建议答题方向（STAR 结构，结合用户简历）",
      "difficulty": "easy|medium|hard"
    }
  ],
  "myStories": ["基于简历可复用的 STAR 故事 3-5 个"],
  "questionsToAsk": ["反问面试官的问题 3-5 个，体现思考深度"]
}

生成 8-12 个问题，覆盖 5 个类别。输出 JSON：`;

export const MATCH_SCORE_PROMPT = `请评估简历与 JD 的匹配度，输出 JSON：
{
  "score": 0-100,
  "reasons": ["理由 1", "理由 2", "理由 3"],
  "gaps": ["差距项 1"],
  "suggestions": ["改进建议 1"]
}

JD:
{jd}

简历:
{resume}

输出 JSON：`;

export const CHAT_SYSTEM_WITH_CONTEXT = `当前用户上下文：
- 目标岗位：{jobTitle}
- 公司：{company}
- 简历：{resumeExcerpt}

基于以上上下文回答用户问题。如果问题与上下文无关，按通用求职教练身份回答。`;

/**
 * 简单模板替换，避免引入模板引擎
 */
export function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
}
