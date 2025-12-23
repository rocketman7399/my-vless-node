export default {
  async fetch(request, env) {
    const userID = 'fdfc4d59-2c47-49df-9334-fb5cf5798944'; // 你的 UUID
    const url = new URL(request.url);

    // 1. 网页显示配置信息
    if (request.headers.get('Upgrade') !== 'websocket') {
      const host = request.headers.get('Host');
      if (url.pathname === '/') {
        return new Response("Service is Active", { status: 200 });
      }
      if (url.pathname === `/${userID}`) {
        // 自动生成的节点链接
        const vlessLink = `vless://${userID}@${host}:443?encryption=none&security=tls&sni=${host}&fp=randomized&type=ws&host=${host}&path=%2F%3Fed%3D2048#CF_SubNode`;
        return new Response(vlessLink, { status: 200 });
      }
      return new Response('Not Found', { status: 404 });
    }

    // 2. 流量转发逻辑
    return await handleVless(request);
  }
};

async function handleVless(request) {
  const { connect } = await import('cloudflare:sockets');
  const webSocketPair = new WebSocketPair();
  const [client, webSocket] = Object.values(webSocketPair);
  webSocket.accept();

  let remoteSocket = { value: null };

  webSocket.addEventListener('message', async (event) => {
    const message = event.data;
    if (remoteSocket.value) {
      const writer = remoteSocket.value.writable.getWriter();
      await writer.write(new Uint8Array(message));
      writer.releaseLock();
      return;
    }

    const chunk = new Uint8Array(message);
    const addressType = chunk[17];
    let address = "";
    if (addressType === 1) address = chunk.slice(19, 23).join('.');
    else if (addressType === 2) address = new TextDecoder().decode(chunk.slice(20, 20 + chunk[19]));
    const port = (chunk[chunk.length - 2] << 8) | chunk[chunk.length - 1];

    const socket = connect({ hostname: address, port: port });
    remoteSocket.value = socket;

    socket.readable.pipeTo(new WritableStream({
      write(chunk) { webSocket.send(chunk); }
    }));
  });

  return new Response(null, { status: 101, webSocket: client });
}
