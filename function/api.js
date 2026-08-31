import { getStore } from "@netlify/blobs";

export default async (req) => {
    
    const headers = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "x-admin-password, Content-Type",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
        "Pragma": "no-cache",
        "Expires": "0",
        "Surrogate-Control": "no-store"
    };

    if (req.method === "OPTIONS") {
        return new Response(null, { status: 204, headers });
    }

    try {
        const store = getStore("lua_scripts");
        const url = new URL(req.url);
        const method = req.method;
        let rawId = url.searchParams.get("raw");
        
        if (!rawId) {
            const pathParts = url.pathname.split('/').filter(Boolean);
            if (pathParts.length >= 2 && pathParts[pathParts.length - 2] === 'raw') {
                rawId = pathParts[pathParts.length - 1];
            }
        }

        if (method === "GET" && rawId) {
            const content = await store.get(rawId);
            if (content === null) return new Response("Error: Script not found", { status: 404 });
            
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

        const adminPass = req.headers.get("x-admin-password");
        if (adminPass !== "MrMadara") {
            return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
        }

        const id = url.searchParams.get("id");

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

        if (method === "POST") {
            const targetId = Math.random().toString(36).substring(2, 10);
            const filename = body.filename || `script_${targetId}.lua`;
            await store.set(targetId, body.content || "", { metadata: { filename } });
            return new Response(JSON.stringify({ id: targetId }), { status: 200, headers });
        }

        if (method === "PUT") {
            if (!body.id) return new Response(JSON.stringify({ error: "Missing ID" }), { status: 400, headers });
            await store.set(body.id, body.content || "", { metadata: { filename: body.filename } });
            return new Response(JSON.stringify({ id: body.id }), { status: 200, headers });
        }

        if (method === "DELETE") {
            if (body.id) await store.delete(body.id);
            return new Response(JSON.stringify({ success: true }), { status: 200, headers });
        }

        return new Response(JSON.stringify({ error: "Method Not Allowed" }), { status: 405, headers });

    } catch (error) {
        
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers });
    }
};
