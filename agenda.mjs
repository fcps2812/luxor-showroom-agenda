import { getStore } from "@netlify/blobs";

const STORE = "luxor-showroom-agenda";
const ALLOWED = new Set(["slots", "days"]);

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,PUT,DELETE,OPTIONS",
      "access-control-allow-headers": "Content-Type"
    }
  });
}

function store() {
  return getStore({ name: STORE, consistency: "strong" });
}

async function readCollection(collection) {
  const s = store();
  const prefix = `${collection}/`;
  const { blobs } = await s.list({ prefix });
  const result = {};
  for (const item of blobs) {
    const key = item.key.slice(prefix.length);
    const value = await s.get(item.key, { type: "json" });
    if (value !== null) result[key] = value;
  }
  return result;
}

function parsePath(req) {
  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean);
  const fnIndex = parts.indexOf("agenda");
  return fnIndex >= 0 ? parts.slice(fnIndex + 1) : [];
}

export default async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true });

  try {
    const rest = parsePath(req);
    const [collection, id] = rest;

    // Endpoint usado pela página para carregar toda a agenda.
    if (req.method === "GET" && collection === "data" && !id) {
      const [slots, days] = await Promise.all([
        readCollection("slots"),
        readCollection("days")
      ]);
      return json({ slots, days });
    }

    if (!collection) return json({ ok: true, service: "Luxor Showroom Agenda" });
    if (!ALLOWED.has(collection)) return json({ error: "Coleção inválida." }, 400);

    const s = store();
    const prefix = `${collection}/`;

    if (req.method === "GET" && !id) {
      return json(await readCollection(collection));
    }

    if (!id) return json({ error: "ID ausente." }, 400);

    const key = `${collection}/${id}`;

    if (req.method === "GET") {
      const value = await s.get(key, { type: "json" });
      return value === null ? json({ error: "Não encontrado." }, 404) : json(value);
    }

    if (req.method === "PUT") {
      const data = await req.json();
      await s.setJSON(key, data);
      return json({ ok: true, data });
    }

    if (req.method === "DELETE") {
      await s.delete(key);
      return json({ ok: true });
    }

    return json({ error: "Método não permitido." }, 405);
  } catch (error) {
    console.error("Luxor agenda error:", error);
    return json({ error: "Erro interno ao acessar a agenda." }, 500);
  }
};
