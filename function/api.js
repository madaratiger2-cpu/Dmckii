import { getStore } from "@netlify/blobs";

export default async (req, context) => {
    const headers = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
        "Pragma": "no-cache",
        "Expires": "0",
        "Surrogate-Control": "no-store"
    };

    const ADMIN_PASSWORD = "Harshdeep";

    try {
        const store = getStore("lua_scripts");
        const url = new URL(req.url);
        const method = req.method;
        const id = url.searchParams.get("id");
        const raw = url.searchParams.get("raw");

        if (method === "GET" && raw) {
            const content = await store.get(raw);
            if (content === null) return new Response("Error: Script not found", { status: 404, headers });
            
            return new Response(content, { 
                status: 200, 
                headers: { 
                    "Content-Type": "text/plain; charset=utf-8", 
                    "Access-Control-Allow-Origin": "*",
                    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
                    "Surrogate-Control": "no-store"
                } 
            });
        }

        const clientPassword = req.headers.get("x-admin-password");
        if (clientPassword !== ADMIN_PASSWORD) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
        }

        if (method === "GET" && id) {
            const res = await store.getWithMetadata(id);
            if (!res || res.data === null) {
                return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers });
            }
            return new Response(JSON.stringify({ 
                id: id, 
                content: res.data, 
                filename: res.metadata?.filename || id 
            }), { status: 200, headers });
        }

        if (method === "GET") {
            const list = await store.list();
            return new Response(JSON.stringify(list.blobs || []), { status: 200, headers });
        }

        const body = await req.json().catch(() => ({}));

        if (method === "POST" || method === "PUT") {
            const targetId = body.id || Math.random().toString(36).substring(2, 10);
            const filename = body.filename || `script_${targetId}.lua`;
            await store.set(targetId, body.content || "", { metadata: { filename } });
            return new Response(JSON.stringify({ id: targetId }), { status: 200, headers });
        }

        if (method === "DELETE") {
            if (body.id) await store.delete(body.id);
            return new Response(JSON.stringify({ success: true }), { status: 200, headers });
        }

        return new Response(JSON.stringify({ error: "Method Not Allowed" }), { status: 405, headers });

    } catch (error) {
        return new Response(JSON.stringify({ error: "Backend Crash: " + error.message }), { status: 500, headers });
    }
};
