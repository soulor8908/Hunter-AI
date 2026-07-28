// Hunter AI — 简历文件解析
// 支持：.docx（mammoth）、.pdf（pdfjs-dist）、.txt/.md（直接读取）
// 动态导入：解析库体积较大，仅在使用时加载
//
// 注意：mammoth 在浏览器环境需其 dist 版本，pdfjs-dist 需配置 worker

/**
 * 解析简历文件为纯文本。
 * 根据文件扩展名/MIME 类型分发到对应解析器。
 * @param file 用户上传的文件
 * @returns 解析后的纯文本
 */
export async function parseResumeFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  const type = file.type;

  if (name.endsWith('.docx') || type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return parseDocx(file);
  }
  if (name.endsWith('.pdf') || type === 'application/pdf') {
    return parsePdf(file);
  }
  if (name.endsWith('.doc') || type === 'application/msword') {
    // .doc（旧版二进制格式）浏览器端无法解析，提示用户转 .docx
    throw new Error('旧版 .doc 格式不支持，请另存为 .docx 后重试');
  }
  // .txt / .md / .json 等文本格式直接读取
  return await file.text();
}

/**
 * 解析 .docx 文件为纯文本。
 * 使用 mammoth.js 的 extractRawText。
 */
async function parseDocx(file: File): Promise<string> {
  const { default: mammoth } = await import('mammoth/mammoth.browser');
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  const text = result.value?.trim();
  if (!text) throw new Error('Word 文档内容为空');
  return text;
}

/**
 * 解析 PDF 文件为纯文本。
 * 使用 pdfjs-dist，配置 worker 为 CDN 版本以兼容浏览器环境。
 */
async function parsePdf(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  // 设置 worker —— 使用与 pdfjs-dist 版本匹配的 CDN worker
  const pdfjsLib: any = pdfjs;
  if (pdfjsLib.GlobalWorkerOptions) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
  }
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  const parts: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((item: any) => item.str ?? '')
      .join(' ');
    parts.push(text);
  }
  const text = parts.join('\n\n').trim();
  if (!text) throw new Error('PDF 内容为空或为扫描件（无可提取文本）');
  return text;
}
