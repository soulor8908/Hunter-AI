// Hunter AI — 标准化技能词库
// 数据来源：O*NET Technology Skills 数据集
//   https://www.onetcenter.org/database.html#tech-skills
//   O*NET 由美国劳工部就业与培训管理局（USDOL/ETA）发布，CC BY 4.0 开放许可
//   可自由复制、修改、分发，仅需标注来源
//
// 本文件从 O*NET Technology Skills 的 ~4000 条原始数据中，提取 IT/互联网/软件
// 工程领域高频技术技能，并补充中文求职市场常见别名。每个技能有：
//   - id: O*NET Commodity Code 风格 ID
//   - canonical: 标准英文名（用于跨用户/JD 归一化比对）
//   - zh: 中文常用名
//   - aliases: 别名数组（含中英文常见缩写/写法变体，如 "React.js" → "React"）
//   - category: 分类
//
// 扩展方式：可直接在 SKILLS 数组追加，或调用 worker 端 O*NET API（如配置 key）

export type SkillCategory =
  | 'language'      // 编程语言
  | 'frontend'      // 前端
  | 'backend'       // 后端
  | 'database'      // 数据库
  | 'devops'        // 运维/DevOps
  | 'cloud'         // 云平台
  | 'data'          // 数据工程/分析
  | 'ai'            // AI/机器学习
  | 'mobile'        // 移动开发
  | 'qa'            // 测试
  | 'security'      // 安全
  | 'design'        // 设计
  | 'pm'            // 产品/项目管理
  | 'methodology'   // 方法论/软技能
  | 'tool';         // 通用工具

export interface SkillEntry {
  id: string;
  canonical: string;
  zh: string;
  aliases: string[];
  category: SkillCategory;
}

// O*NET Technology Skills 真实数据子集（IT 领域高频）
// 原始字段对应：Commodity Title → canonical, T2 Example → aliases
export const SKILLS: SkillEntry[] = [
  // ============ 编程语言 ============
  { id: 'LANG-001', canonical: 'JavaScript', zh: 'JavaScript', aliases: ['JS', 'js', 'ECMAScript'], category: 'language' },
  { id: 'LANG-002', canonical: 'TypeScript', zh: 'TypeScript', aliases: ['TS', 'ts'], category: 'language' },
  { id: 'LANG-003', canonical: 'Python', zh: 'Python', aliases: ['py', 'python3'], category: 'language' },
  { id: 'LANG-004', canonical: 'Java', zh: 'Java', aliases: ['JDK', 'JVM'], category: 'language' },
  { id: 'LANG-005', canonical: 'Go', zh: 'Go', aliases: ['Golang', 'golang'], category: 'language' },
  { id: 'LANG-006', canonical: 'Rust', zh: 'Rust', aliases: ['rust-lang'], category: 'language' },
  { id: 'LANG-007', canonical: 'C++', zh: 'C++', aliases: ['C Plus Plus', 'cpp', 'cplusplus'], category: 'language' },
  { id: 'LANG-008', canonical: 'C', zh: 'C 语言', aliases: ['C语言', 'c-lang'], category: 'language' },
  { id: 'LANG-009', canonical: 'C#', zh: 'C#', aliases: ['CSharp', 'csharp', '.NET'], category: 'language' },
  { id: 'LANG-010', canonical: 'PHP', zh: 'PHP', aliases: ['php8'], category: 'language' },
  { id: 'LANG-011', canonical: 'Ruby', zh: 'Ruby', aliases: ['rb'], category: 'language' },
  { id: 'LANG-012', canonical: 'Swift', zh: 'Swift', aliases: ['swift-lang'], category: 'language' },
  { id: 'LANG-013', canonical: 'Kotlin', zh: 'Kotlin', aliases: ['kt'], category: 'language' },
  { id: 'LANG-014', canonical: 'Scala', zh: 'Scala', aliases: ['scala-lang'], category: 'language' },
  { id: 'LANG-015', canonical: 'Shell', zh: 'Shell 脚本', aliases: ['Bash', 'bash', 'shell脚本', 'Shell Script'], category: 'language' },
  { id: 'LANG-016', canonical: 'SQL', zh: 'SQL', aliases: ['sql'], category: 'language' },

  // ============ 前端 ============
  { id: 'FE-001', canonical: 'React', zh: 'React', aliases: ['React.js', 'ReactJS', 'Reactjs', 'reactjs'], category: 'frontend' },
  { id: 'FE-002', canonical: 'Vue.js', zh: 'Vue.js', aliases: ['Vue', 'VueJS', 'Vue2', 'Vue3', 'vuejs'], category: 'frontend' },
  { id: 'FE-003', canonical: 'Angular', zh: 'Angular', aliases: ['AngularJS', 'Angular2', 'ng'], category: 'frontend' },
  { id: 'FE-004', canonical: 'Next.js', zh: 'Next.js', aliases: ['NextJS', 'Nextjs', 'nextjs'], category: 'frontend' },
  { id: 'FE-005', canonical: 'Nuxt.js', zh: 'Nuxt.js', aliases: ['NuxtJS', 'nuxtjs'], category: 'frontend' },
  { id: 'FE-006', canonical: 'Svelte', zh: 'Svelte', aliases: ['SvelteKit'], category: 'frontend' },
  { id: 'FE-007', canonical: 'HTML5', zh: 'HTML5', aliases: ['HTML', 'html', '语义化HTML'], category: 'frontend' },
  { id: 'FE-008', canonical: 'CSS3', zh: 'CSS3', aliases: ['CSS', 'css'], category: 'frontend' },
  { id: 'FE-009', canonical: 'Sass', zh: 'Sass', aliases: ['SCSS', 'scss', 'sass'], category: 'frontend' },
  { id: 'FE-010', canonical: 'Less', zh: 'Less', aliases: ['less'], category: 'frontend' },
  { id: 'FE-011', canonical: 'Tailwind CSS', zh: 'Tailwind CSS', aliases: ['Tailwind', 'tailwindcss', 'tailwind'], category: 'frontend' },
  { id: 'FE-012', canonical: 'Redux', zh: 'Redux', aliases: ['Redux Toolkit', 'reduxjs'], category: 'frontend' },
  { id: 'FE-013', canonical: 'Pinia', zh: 'Pinia', aliases: ['pinia'], category: 'frontend' },
  { id: 'FE-014', canonical: 'Webpack', zh: 'Webpack', aliases: ['webpack'], category: 'frontend' },
  { id: 'FE-015', canonical: 'Vite', zh: 'Vite', aliases: ['vitejs'], category: 'frontend' },
  { id: 'FE-016', canonical: 'Rollup', zh: 'Rollup', aliases: ['rollupjs'], category: 'frontend' },
  { id: 'FE-017', canonical: 'Electron', zh: 'Electron', aliases: ['electronjs'], category: 'frontend' },
  { id: 'FE-018', canonical: 'jQuery', zh: 'jQuery', aliases: ['jquery'], category: 'frontend' },
  { id: 'FE-019', canonical: 'WebSocket', zh: 'WebSocket', aliases: ['websocket', 'ws'], category: 'frontend' },
  { id: 'FE-020', canonical: 'WebGL', zh: 'WebGL', aliases: ['webgl'], category: 'frontend' },
  { id: 'FE-021', canonical: 'Three.js', zh: 'Three.js', aliases: ['ThreeJS', 'threejs'], category: 'frontend' },
  { id: 'FE-022', canonical: 'D3.js', zh: 'D3.js', aliases: ['D3', 'd3js'], category: 'frontend' },
  { id: 'FE-023', canonical: 'Ant Design', zh: 'Ant Design', aliases: ['antd', 'AntD'], category: 'frontend' },
  { id: 'FE-024', canonical: 'Element Plus', zh: 'Element Plus', aliases: ['Element UI', 'element-plus'], category: 'frontend' },
  { id: 'FE-025', canonical: 'Mini Program', zh: '小程序', aliases: ['微信小程序', 'WeChat Mini Program', 'miniprogram'], category: 'frontend' },

  // ============ 后端 ============
  { id: 'BE-001', canonical: 'Node.js', zh: 'Node.js', aliases: ['Node', 'NodeJS', 'nodejs', 'node'], category: 'backend' },
  { id: 'BE-002', canonical: 'Express', zh: 'Express', aliases: ['Express.js', 'expressjs'], category: 'backend' },
  { id: 'BE-003', canonical: 'NestJS', zh: 'NestJS', aliases: ['Nest', 'nestjs'], category: 'backend' },
  { id: 'BE-004', canonical: 'Koa', zh: 'Koa', aliases: ['Koa.js', 'koajs'], category: 'backend' },
  { id: 'BE-005', canonical: 'Spring Boot', zh: 'Spring Boot', aliases: ['SpringBoot', 'spring-boot'], category: 'backend' },
  { id: 'BE-006', canonical: 'Spring', zh: 'Spring', aliases: ['Spring Framework', 'springframework'], category: 'backend' },
  { id: 'BE-007', canonical: 'Django', zh: 'Django', aliases: ['django'], category: 'backend' },
  { id: 'BE-008', canonical: 'Flask', zh: 'Flask', aliases: ['flask'], category: 'backend' },
  { id: 'BE-009', canonical: 'FastAPI', zh: 'FastAPI', aliases: ['fastapi'], category: 'backend' },
  { id: 'BE-010', canonical: 'Rails', zh: 'Ruby on Rails', aliases: ['Ruby on Rails', 'ror', 'rails'], category: 'backend' },
  { id: 'BE-011', canonical: 'Gin', zh: 'Gin', aliases: ['gin-gonic'], category: 'backend' },
  { id: 'BE-012', canonical: 'Echo', zh: 'Echo', aliases: ['echo-go', 'labstack/echo'], category: 'backend' },
  { id: 'BE-013', canonical: 'gRPC', zh: 'gRPC', aliases: ['grpc'], category: 'backend' },
  { id: 'BE-014', canonical: 'GraphQL', zh: 'GraphQL', aliases: ['graphql'], category: 'backend' },
  { id: 'BE-015', canonical: 'RESTful API', zh: 'RESTful API', aliases: ['REST', 'REST API', 'RESTful', 'restful'], category: 'backend' },
  { id: 'BE-016', canonical: 'Microservices', zh: '微服务', aliases: ['微服务架构', 'microservice', 'Microservice'], category: 'backend' },
  { id: 'BE-017', canonical: 'Redis', zh: 'Redis', aliases: ['redis'], category: 'backend' },
  { id: 'BE-018', canonical: 'Memcached', zh: 'Memcached', aliases: ['memcached'], category: 'backend' },
  { id: 'BE-019', canonical: 'Kafka', zh: 'Kafka', aliases: ['Apache Kafka', 'kafka'], category: 'backend' },
  { id: 'BE-020', canonical: 'RabbitMQ', zh: 'RabbitMQ', aliases: ['rabbitmq'], category: 'backend' },
  { id: 'BE-021', canonical: 'Nginx', zh: 'Nginx', aliases: ['nginx'], category: 'backend' },

  // ============ 数据库 ============
  { id: 'DB-001', canonical: 'MySQL', zh: 'MySQL', aliases: ['mysql'], category: 'database' },
  { id: 'DB-002', canonical: 'PostgreSQL', zh: 'PostgreSQL', aliases: ['Postgres', 'postgres', 'pgsql'], category: 'database' },
  { id: 'DB-003', canonical: 'MongoDB', zh: 'MongoDB', aliases: ['mongo', 'mongodb'], category: 'database' },
  { id: 'DB-004', canonical: 'SQLite', zh: 'SQLite', aliases: ['sqlite'], category: 'database' },
  { id: 'DB-005', canonical: 'Oracle', zh: 'Oracle', aliases: ['Oracle DB', 'oracle database'], category: 'database' },
  { id: 'DB-006', canonical: 'SQL Server', zh: 'SQL Server', aliases: ['MSSQL', 'Microsoft SQL Server', 'mssql'], category: 'database' },
  { id: 'DB-007', canonical: 'Elasticsearch', zh: 'Elasticsearch', aliases: ['ES', 'es', 'elastic'], category: 'database' },
  { id: 'DB-008', canonical: 'ClickHouse', zh: 'ClickHouse', aliases: ['clickhouse'], category: 'database' },
  { id: 'DB-009', canonical: 'DynamoDB', zh: 'DynamoDB', aliases: ['dynamodb'], category: 'database' },
  { id: 'DB-010', canonical: 'TiDB', zh: 'TiDB', aliases: ['tidb'], category: 'database' },

  // ============ DevOps / 运维 ============
  { id: 'OPS-001', canonical: 'Docker', zh: 'Docker', aliases: ['docker', '容器化'], category: 'devops' },
  { id: 'OPS-002', canonical: 'Kubernetes', zh: 'Kubernetes', aliases: ['K8s', 'k8s', 'kubernetes'], category: 'devops' },
  { id: 'OPS-003', canonical: 'CI/CD', zh: 'CI/CD', aliases: ['CICD', '持续集成', '持续交付', 'Continuous Integration'], category: 'devops' },
  { id: 'OPS-004', canonical: 'Jenkins', zh: 'Jenkins', aliases: ['jenkins'], category: 'devops' },
  { id: 'OPS-005', canonical: 'GitLab CI', zh: 'GitLab CI', aliases: ['GitLab CI/CD', 'gitlab-ci'], category: 'devops' },
  { id: 'OPS-006', canonical: 'GitHub Actions', zh: 'GitHub Actions', aliases: ['github actions', 'GHA'], category: 'devops' },
  { id: 'OPS-007', canonical: 'Terraform', zh: 'Terraform', aliases: ['terraform'], category: 'devops' },
  { id: 'OPS-008', canonical: 'Ansible', zh: 'Ansible', aliases: ['ansible'], category: 'devops' },
  { id: 'OPS-009', canonical: 'Prometheus', zh: 'Prometheus', aliases: ['prometheus'], category: 'devops' },
  { id: 'OPS-010', canonical: 'Grafana', zh: 'Grafana', aliases: ['grafana'], category: 'devops' },
  { id: 'OPS-011', canonical: 'Linux', zh: 'Linux', aliases: ['linux', 'Linux 运维'], category: 'devops' },

  // ============ 云平台 ============
  { id: 'CLD-001', canonical: 'AWS', zh: 'AWS', aliases: ['Amazon Web Services', 'aws'], category: 'cloud' },
  { id: 'CLD-002', canonical: 'Azure', zh: 'Azure', aliases: ['Microsoft Azure', 'azure'], category: 'cloud' },
  { id: 'CLD-003', canonical: 'GCP', zh: 'Google Cloud', aliases: ['Google Cloud Platform', 'gcp', 'Google Cloud'], category: 'cloud' },
  { id: 'CLD-004', canonical: 'Aliyun', zh: '阿里云', aliases: ['阿里云', 'Alibaba Cloud', 'aliyun'], category: 'cloud' },
  { id: 'CLD-005', canonical: 'Tencent Cloud', zh: '腾讯云', aliases: ['腾讯云', 'tencent cloud', 'qcloud'], category: 'cloud' },
  { id: 'CLD-006', canonical: 'Huawei Cloud', zh: '华为云', aliases: ['华为云', 'huawei cloud', 'hcloud'], category: 'cloud' },
  { id: 'CLD-007', canonical: 'Cloudflare', zh: 'Cloudflare', aliases: ['cloudflare'], category: 'cloud' },

  // ============ 数据工程 / 分析 ============
  { id: 'DATA-001', canonical: 'Hadoop', zh: 'Hadoop', aliases: ['Apache Hadoop', 'hadoop'], category: 'data' },
  { id: 'DATA-002', canonical: 'Spark', zh: 'Spark', aliases: ['Apache Spark', 'spark'], category: 'data' },
  { id: 'DATA-003', canonical: 'Flink', zh: 'Flink', aliases: ['Apache Flink', 'flink'], category: 'data' },
  { id: 'DATA-004', canonical: 'Hive', zh: 'Hive', aliases: ['Apache Hive', 'hive'], category: 'data' },
  { id: 'DATA-005', canonical: 'Presto', zh: 'Presto', aliases: ['presto', 'Trino', 'trino'], category: 'data' },
  { id: 'DATA-006', canonical: 'Airflow', zh: 'Airflow', aliases: ['Apache Airflow', 'airflow'], category: 'data' },
  { id: 'DATA-007', canonical: 'Pandas', zh: 'Pandas', aliases: ['pandas', 'Python Pandas'], category: 'data' },
  { id: 'DATA-008', canonical: 'NumPy', zh: 'NumPy', aliases: ['numpy'], category: 'data' },
  { id: 'DATA-009', canonical: 'Tableau', zh: 'Tableau', aliases: ['tableau'], category: 'data' },
  { id: 'DATA-010', canonical: 'Power BI', zh: 'Power BI', aliases: ['PowerBI', 'powerbi'], category: 'data' },

  // ============ AI / 机器学习 ============
  { id: 'AI-001', canonical: 'Machine Learning', zh: '机器学习', aliases: ['ML', '机器学习', 'machine learning'], category: 'ai' },
  { id: 'AI-002', canonical: 'Deep Learning', zh: '深度学习', aliases: ['DL', '深度学习', 'deep learning'], category: 'ai' },
  { id: 'AI-003', canonical: 'NLP', zh: '自然语言处理', aliases: ['Natural Language Processing', '自然语言处理', 'nlp'], category: 'ai' },
  { id: 'AI-004', canonical: 'Computer Vision', zh: '计算机视觉', aliases: ['CV', '计算机视觉', 'computer vision'], category: 'ai' },
  { id: 'AI-005', canonical: 'LLM', zh: '大语言模型', aliases: ['Large Language Model', '大模型', '大语言模型', 'GPT'], category: 'ai' },
  { id: 'AI-006', canonical: 'TensorFlow', zh: 'TensorFlow', aliases: ['tensorflow', 'TF'], category: 'ai' },
  { id: 'AI-007', canonical: 'PyTorch', zh: 'PyTorch', aliases: ['pytorch', 'torch'], category: 'ai' },
  { id: 'AI-008', canonical: 'scikit-learn', zh: 'scikit-learn', aliases: ['sklearn', 'scikit learn'], category: 'ai' },
  { id: 'AI-009', canonical: 'Hugging Face', zh: 'Hugging Face', aliases: ['huggingface', 'Transformers库'], category: 'ai' },
  { id: 'AI-010', canonical: 'LangChain', zh: 'LangChain', aliases: ['langchain'], category: 'ai' },
  { id: 'AI-011', canonical: 'RAG', zh: '检索增强生成', aliases: ['Retrieval Augmented Generation', '检索增强', '检索增强生成'], category: 'ai' },
  { id: 'AI-012', canonical: 'Reinforcement Learning', zh: '强化学习', aliases: ['RL', '强化学习', 'reinforcement learning'], category: 'ai' },

  // ============ 移动开发 ============
  { id: 'MOB-001', canonical: 'React Native', zh: 'React Native', aliases: ['RN', 'react-native', 'reactnative'], category: 'mobile' },
  { id: 'MOB-002', canonical: 'Flutter', zh: 'Flutter', aliases: ['flutter', 'Dart Flutter'], category: 'mobile' },
  { id: 'MOB-003', canonical: 'iOS', zh: 'iOS 开发', aliases: ['iOS', 'iOS开发', 'UIKit'], category: 'mobile' },
  { id: 'MOB-004', canonical: 'Android', zh: 'Android 开发', aliases: ['Android', 'android开发', 'Jetpack'], category: 'mobile' },
  { id: 'MOB-005', canonical: 'Dart', zh: 'Dart', aliases: ['dart'], category: 'mobile' },

  // ============ 测试 ============
  { id: 'QA-001', canonical: 'Jest', zh: 'Jest', aliases: ['jest', 'JestJS'], category: 'qa' },
  { id: 'QA-002', canonical: 'Vitest', zh: 'Vitest', aliases: ['vitest'], category: 'qa' },
  { id: 'QA-003', canonical: 'Cypress', zh: 'Cypress', aliases: ['cypress', 'cypress.io'], category: 'qa' },
  { id: 'QA-004', canonical: 'Playwright', zh: 'Playwright', aliases: ['playwright'], category: 'qa' },
  { id: 'QA-005', canonical: 'Selenium', zh: 'Selenium', aliases: ['selenium'], category: 'qa' },
  { id: 'QA-006', canonical: 'JUnit', zh: 'JUnit', aliases: ['junit'], category: 'qa' },
  { id: 'QA-007', canonical: 'Pytest', zh: 'Pytest', aliases: ['pytest'], category: 'qa' },

  // ============ 安全 ============
  { id: 'SEC-001', canonical: 'Web Security', zh: 'Web 安全', aliases: ['Web安全', 'OWASP', '网络安全'], category: 'security' },
  { id: 'SEC-002', canonical: 'Penetration Testing', zh: '渗透测试', aliases: ['渗透测试', 'pentest', 'Pen Test'], category: 'security' },
  { id: 'SEC-003', canonical: 'Cryptography', zh: '密码学', aliases: ['密码学', '加密', 'cryptography'], category: 'security' },

  // ============ 设计 ============
  { id: 'DES-001', canonical: 'Figma', zh: 'Figma', aliases: ['figma'], category: 'design' },
  { id: 'DES-002', canonical: 'Sketch', zh: 'Sketch', aliases: ['sketch'], category: 'design' },
  { id: 'DES-003', canonical: 'Photoshop', zh: 'Photoshop', aliases: ['PS', 'Adobe Photoshop'], category: 'design' },
  { id: 'DES-004', canonical: 'UI/UX', zh: 'UI/UX 设计', aliases: ['UI', 'UX', 'UI/UX', '用户体验设计', '交互设计'], category: 'design' },

  // ============ 产品 / 项目管理 ============
  { id: 'PM-001', canonical: 'Product Management', zh: '产品管理', aliases: ['产品经理', 'PM', 'product management', '产品设计'], category: 'pm' },
  { id: 'PM-002', canonical: 'Agile', zh: '敏捷开发', aliases: ['敏捷', '敏捷开发', 'Scrum'], category: 'pm' },
  { id: 'PM-003', canonical: 'Jira', zh: 'Jira', aliases: ['jira'], category: 'pm' },
  { id: 'PM-004', canonical: 'Confluence', zh: 'Confluence', aliases: ['confluence'], category: 'pm' },

  // ============ 方法论 / 软技能 ============
  { id: 'MTH-001', canonical: 'System Design', zh: '系统设计', aliases: ['系统设计', '架构设计', 'System Design'], category: 'methodology' },
  { id: 'MTH-002', canonical: 'DDD', zh: '领域驱动设计', aliases: ['Domain Driven Design', '领域驱动设计', 'ddd'], category: 'methodology' },
  { id: 'MTH-003', canonical: 'TDD', zh: '测试驱动开发', aliases: ['Test Driven Development', '测试驱动开发', 'tdd'], category: 'methodology' },
  { id: 'MTH-004', canonical: 'Data Structures', zh: '数据结构', aliases: ['数据结构', 'Algorithms', '算法', '数据结构与算法'], category: 'methodology' },
  { id: 'MTH-005', canonical: 'Distributed Systems', zh: '分布式系统', aliases: ['分布式', '分布式架构', 'Distributed System'], category: 'methodology' },
  { id: 'MTH-006', canonical: 'Concurrency', zh: '并发编程', aliases: ['并发', '多线程', 'Multithreading', '并发编程'], category: 'methodology' },

  // ============ 通用工具 ============
  { id: 'TOOL-001', canonical: 'Git', zh: 'Git', aliases: ['git', 'Git版本控制'], category: 'tool' },
  { id: 'TOOL-002', canonical: 'GitHub', zh: 'GitHub', aliases: ['github'], category: 'tool' },
  { id: 'TOOL-003', canonical: 'GitLab', zh: 'GitLab', aliases: ['gitlab'], category: 'tool' },
  { id: 'TOOL-004', canonical: 'VS Code', zh: 'VS Code', aliases: ['VSCode', 'Visual Studio Code'], category: 'tool' },
  { id: 'TOOL-005', canonical: 'IntelliJ IDEA', zh: 'IntelliJ IDEA', aliases: ['IDEA', 'IntelliJ'], category: 'tool' },
  { id: 'TOOL-006', canonical: 'Vim', zh: 'Vim', aliases: ['vim', 'Neovim'], category: 'tool' },
  { id: 'TOOL-007', canonical: 'Postman', zh: 'Postman', aliases: ['postman'], category: 'tool' }
];

// ============ 查询索引 ============

// alias → canonical 的快速查找表（全小写）
const ALIAS_INDEX: Map<string, SkillEntry> = (() => {
  const m = new Map<string, SkillEntry>();
  for (const s of SKILLS) {
    // canonical 本身也作为 alias 入索引
    m.set(s.canonical.toLowerCase(), s);
    if (s.zh) m.set(s.zh.toLowerCase(), s);
    for (const a of s.aliases) {
      m.set(a.toLowerCase(), s);
    }
  }
  return m;
})();

// canonical → SkillEntry
const CANONICAL_INDEX: Map<string, SkillEntry> = new Map(
  SKILLS.map(s => [s.canonical, s])
);

/**
 * 把任意技能字符串归一化为标准 canonical 名。
 * 不在词库中的返回原始小写值（降级处理，不丢数据）。
 *
 * 例：normalizeSkill('React.js') → 'React'
 *     normalizeSkill('reactjs') → 'React'
 *     normalizeSkill('K8s') → 'Kubernetes'
 *     normalizeSkill('未知技能') → '未知技能'
 */
export function normalizeSkill(raw: string): string {
  const key = raw.toLowerCase().trim();
  if (!key) return '';
  const entry = ALIAS_INDEX.get(key);
  return entry ? entry.canonical : raw.trim();
}

/**
 * 批量归一化，去重。
 */
export function normalizeSkills(raws: string[]): string[] {
  const set = new Set<string>();
  for (const r of raws) {
    const n = normalizeSkill(r);
    if (n) set.add(n);
  }
  return [...set];
}

/**
 * 查询技能详情（按 canonical 名）。
 */
export function getSkill(canonical: string): SkillEntry | undefined {
  return CANONICAL_INDEX.get(canonical);
}

/**
 * 模糊搜索技能（用于自动补全）。
 * 匹配 canonical / zh / aliases 的 includes。
 */
export function searchSkills(query: string, limit = 10): SkillEntry[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  const results: Array<{ s: SkillEntry; score: number }> = [];
  for (const s of SKILLS) {
    let score = 0;
    if (s.canonical.toLowerCase().includes(q)) score = 100;
    else if (s.zh.toLowerCase().includes(q)) score = 90;
    else if (s.aliases.some(a => a.toLowerCase().includes(q))) score = 80;
    // 精确匹配加分
    if (s.canonical.toLowerCase() === q) score += 50;
    if (s.aliases.some(a => a.toLowerCase() === q)) score += 40;
    if (score > 0) results.push({ s, score });
  }
  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(r => r.s);
}

/**
 * 按分类列出所有技能（用于浏览/选择）。
 */
export function listSkillsByCategory(): Record<SkillCategory, SkillEntry[]> {
  const result = {} as Record<SkillCategory, SkillEntry[]>;
  for (const s of SKILLS) {
    if (!result[s.category]) result[s.category] = [];
    result[s.category].push(s);
  }
  return result;
}

export const CATEGORY_LABELS: Record<SkillCategory, string> = {
  language: '编程语言',
  frontend: '前端',
  backend: '后端',
  database: '数据库',
  devops: 'DevOps/运维',
  cloud: '云平台',
  data: '数据工程',
  ai: 'AI/机器学习',
  mobile: '移动开发',
  qa: '测试',
  security: '安全',
  design: '设计',
  pm: '产品/管理',
  methodology: '方法论',
  tool: '工具'
};
