// 完整流量转发版
export default {
  async fetch(request, env) {
    const userID = 'fdfc4d59-2c47-49df-9334-fb5cf5798944'; // 保持你的 UUID
    const url = new URL(request.url);

    // 1. 网页显示配置信息
    if (request.headers.get('Upgrade') !== 'websocket') {
      const host = request.headers.get('Host');
      if (url.pathname === '/') {
        return new Response("节点状态：在线", { status: 200 });
      }
      if (url.pathname === `/${userID}`) {
        // 生成通用 VLESS 链接
        const vlessLink = `vless://${userID}@${host}:443?encryption=none&security=tls&sni=${host}&fp=randomized&type=ws&host=${host}&path=%2F%3Fed%3D2048#CF_Pages_Node`;
        return new Response(vlessLink, { status: 200 });
      }
      return new Response('Not Found', { status: 404 });
    }

    // 2. 核心流量转发逻辑
    return await vlessOverWS(request, userID);
  }
};

async function vlessOverWS(request, userID) {
  const { connect } = await import('cloudflare:sockets');
  const webSocketPair = new WebSocketPair();
  const [client, webSocket] = Object.values(webSocketPair);
  webSocket.accept();

  let remoteSocketWapper = { value: null };

  // 处理 WebSocket 消息流
  webSocket.addEventListener('message', async (event) => {
    const message = event.data;
    if (remoteSocketWapper.value) {
      const writer = remoteSocketWapper.value.writable.getWriter();
      await writer.write(new Uint8Array(message));
      writer.releaseLock();
      return;
    }

    // 解包 VLESS 协议头部并建立连接
    const chunk = new Uint8Array(message);
    const addressType = chunk[17];
    let address = "";
    let port = 0;

    // 解析目标地址
    if (addressType === 1) address = chunk.slice(19, 23).join('.');
    else if (addressType === 2) address = new TextDecoder().decode(chunk.slice(20, 20 + chunk[19]));
    
    port = (chunk[chunk.length - 2] << 8) | chunk[chunk.length - 1];
    
    // 建立直连 TCP
    const socket = connect({ hostname: address, port: port });
    remoteSocketWapper.value = socket;

    // 转发数据
    socket.readable.pipeTo(new WritableStream({
      write(chunk) { webSocket.send(chunk); }
    }));
  });

  return new Response(null, { status: 101, webSocket: client });
}
