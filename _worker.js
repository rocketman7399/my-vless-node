export default {
  async fetch(request, env) {
    const userID = 'fdfc4d59-2c47-49df-9334-fb5cf5798944';
    const url = new URL(request.url);

    // 网页检测逻辑
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response("🎉 GitHub 自动部署成功！Worker 已上线。", {
        status: 200, headers: { "Content-Type": "text/plain;charset=utf-8" }
      });
    }

    // 代理握手测试
    try {
      const socket = await import('cloudflare:sockets');
      return new Response(null, { status: 101 });
    } catch (e) {
      return new Response("Socket 模块加载中...", { status: 500 });
    }
  }
};
