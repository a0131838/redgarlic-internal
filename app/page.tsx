const sectionStyle = {
  border: "1px solid #e5e7eb",
  borderRadius: 20,
  padding: 24,
  background: "rgba(255, 255, 255, 0.92)",
  boxShadow: "0 18px 50px rgba(15, 23, 42, 0.06)",
};

export default function HomePage() {
  return (
    <main
      style={{
        maxWidth: 1080,
        margin: "0 auto",
        padding: "48px 20px 72px",
        display: "grid",
        gap: 20,
      }}
    >
      <section
        style={{
          ...sectionStyle,
          background:
            "linear-gradient(135deg, rgba(127, 29, 29, 0.94), rgba(146, 64, 14, 0.88))",
          color: "#fff7ed",
        }}
      >
        <div style={{ fontSize: 14, letterSpacing: 1.2, opacity: 0.85 }}>
          HONGSUAN INTELLIGENT
        </div>
        <h1 style={{ margin: "10px 0 12px", fontSize: 40, lineHeight: 1.1 }}>
          宏算智能内部系统
        </h1>
        <p style={{ margin: 0, maxWidth: 760, fontSize: 17, lineHeight: 1.7 }}>
          第一阶段先聚焦文件传输、共享和留痕，第二阶段再扩展成员工账号、
          权限、知识库和内部流程模块。当前骨架已按排课系统的发布纪律设计，
          但数据库、域名、部署配置都会保持独立。
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={{ marginTop: 0 }}>当前基线</h2>
        <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8 }}>
          <li>应用名：redgarlic-internal</li>
          <li>域名：redgarlicai.com</li>
          <li>数据库：独立 Neon PostgreSQL</li>
          <li>运行方式：Next.js + Prisma + PM2 + Nginx</li>
          <li>发布门禁：构建、迁移、健康检查、发布文档更新</li>
        </ul>
        <div style={{ marginTop: 16, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <a
            href="/admin/login"
            style={{
              padding: "10px 16px",
              borderRadius: 999,
              background: "#111827",
              color: "#fff",
              textDecoration: "none",
            }}
          >
            进入后台
          </a>
          <a
            href="/admin/setup"
            style={{
              padding: "10px 16px",
              borderRadius: 999,
              background: "#fff",
              color: "#7f1d1d",
              border: "1px solid #fecaca",
              textDecoration: "none",
            }}
          >
            初始化管理员
          </a>
        </div>
      </section>

      <section
        style={{
          display: "grid",
          gap: 20,
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        }}
      >
        <div style={sectionStyle}>
          <h3 style={{ marginTop: 0 }}>第一期目标</h3>
          <p style={{ marginBottom: 0, lineHeight: 1.7 }}>
            员工登录、文件分类、上传下载、共享检索、操作审计。
          </p>
        </div>
        <div style={sectionStyle}>
          <h3 style={{ marginTop: 0 }}>发布纪律</h3>
          <p style={{ marginBottom: 0, lineHeight: 1.7 }}>
            发布脚本会固定走安装、生成 Prisma Client、迁移、构建和 PM2
            重启，不允许跳过关键步骤。
          </p>
        </div>
        <div style={sectionStyle}>
          <h3 style={{ marginTop: 0 }}>后续扩展</h3>
          <p style={{ marginBottom: 0, lineHeight: 1.7 }}>
            员工目录、审批、知识库、公告、组织权限和操作日志中心。
          </p>
        </div>
      </section>
    </main>
  );
}
