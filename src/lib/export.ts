// Hunter AI — 简历导出工具
// 支持：PDF（html2canvas + jsPDF，所见即所得，中文完美）+ Word（HTML→.doc，可编辑）
// 动态导入：jspdf + html2canvas 体积较大，仅在用户点击导出时才加载，不影响首屏
import { renderMarkdown } from './utils';

/**
 * 把简历 DOM 元素导出为 PDF。
 * 用 html2canvas 把 DOM 转为 canvas，再分页嵌入 jsPDF。
 * 优点：中文渲染完美，所见即所得；缺点：文本不可搜索。
 * @param element 简历预览的 DOM 容器
 * @param filename 不含扩展名
 */
export async function exportResumeToPDF(element: HTMLElement, filename: string): Promise<void> {
  // 动态加载，避免打包进主 bundle
  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
    import('jspdf'),
    import('html2canvas')
  ]);

  // 临时把容器样式改为白底黑字（PDF 友好），导出后还原
  const origBg = element.style.backgroundColor;
  const origColor = element.style.color;
  element.style.backgroundColor = '#ffffff';
  element.style.color = '#000000';

  try {
    const canvas = await html2canvas(element, {
      scale: 2,                 // 2 倍清晰度
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false
    });

    const pdf = new jsPDF({ unit: 'pt', format: 'a4', compress: true });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    // A4 留 32pt 边距
    const margin = 32;
    const usableWidth = pageWidth - margin * 2;
    const usableHeight = pageHeight - margin * 2;

    // 按可用宽度等比缩放图片
    const imgWidth = usableWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    // 分页绘制
    let renderedHeight = 0;
    let pageIndex = 0;
    while (renderedHeight < imgHeight) {
      if (pageIndex > 0) pdf.addPage();
      // 计算本次能绘制的高度（不超过可用高度）
      const sliceHeight = Math.min(usableHeight, imgHeight - renderedHeight);
      // 用临时 canvas 截取本次分页对应的图片区域
      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = canvas.width;
      pageCanvas.height = Math.max(1, Math.floor((sliceHeight * canvas.width) / imgWidth));
      const ctx = pageCanvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        ctx.drawImage(
          canvas,
          0,
          Math.floor((renderedHeight * canvas.width) / imgWidth),
          canvas.width,
          pageCanvas.height,
          0,
          0,
          canvas.width,
          pageCanvas.height
        );
      }
      const pageImgData = pageCanvas.toDataURL('image/png');
      pdf.addImage(pageImgData, 'PNG', margin, margin, imgWidth, sliceHeight);
      renderedHeight += sliceHeight;
      pageIndex++;
    }

    pdf.save(`${filename}.pdf`);
  } finally {
    // 还原样式
    element.style.backgroundColor = origBg;
    element.style.color = origColor;
  }
}

/**
 * 把简历 Markdown 导出为 Word（.doc）。
 * 方案：Markdown → HTML → Word 兼容 HTML 文档（含 Word XML 命名空间）。
 * 优点：可在 Word/WPS/Google Docs 中正常打开和编辑，文本可选可搜索。
 * @param md 简历 Markdown 文本
 * @param filename 不含扩展名
 */
export function exportResumeToWord(md: string, filename: string): void {
  const htmlBody = renderMarkdown(md);
  const fullHtml = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8" />
  <title>${filename}</title>
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
      <w:DoNotOptimizeForBrowser/>
    </w:WordDocument>
  </xml>
  <![endif]-->
  <style>
    @page { size: A4; margin: 2cm; }
    body { font-family: "Microsoft YaHei", "PingFang SC", "Helvetica Neue", Arial, sans-serif; font-size: 11pt; color: #000; line-height: 1.6; }
    h1 { font-size: 20pt; font-weight: bold; margin: 0 0 8pt 0; }
    h2 { font-size: 14pt; font-weight: bold; margin: 14pt 0 6pt 0; border-bottom: 1pt solid #000; padding-bottom: 2pt; }
    h3 { font-size: 12pt; font-weight: bold; margin: 10pt 0 4pt 0; }
    p { margin: 4pt 0; }
    ul, ol { margin: 4pt 0; padding-left: 20pt; }
    li { margin: 2pt 0; }
    strong { font-weight: bold; }
    hr { border: none; border-top: 1pt solid #000; margin: 10pt 0; }
    blockquote { border-left: 3pt solid #000; padding-left: 8pt; margin: 6pt 0; color: #333; font-style: italic; }
    code { font-family: "Consolas", monospace; font-size: 10pt; }
  </style>
</head>
<body>
${htmlBody}
</body>
</html>`;

  const blob = new Blob([fullHtml], { type: 'application/msword;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.doc`;
  a.click();
  URL.revokeObjectURL(url);
}
