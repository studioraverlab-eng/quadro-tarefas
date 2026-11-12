// API do Quadro do Vitor — lê e salva as tarefas no tarefas.json do próprio repositório.
// GET  /api/tarefas            -> devolve o quadro atual (lido ao vivo do GitHub)
// POST /api/tarefas {pin, dados} -> valida o PIN e grava (commit no repositório)

const REPO = 'studioraverlab-eng/quadro-tarefas';
const PATH = 'tarefas.json';
const BRANCH = 'main';

function ghHeaders() {
  return {
    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'quadro-do-vitor',
  };
}

async function lerAtual() {
  const r = await fetch(
    `https://api.github.com/repos/${REPO}/contents/${PATH}?ref=${BRANCH}`,
    { headers: ghHeaders() }
  );
  if (!r.ok) throw new Error('github read ' + r.status);
  const j = await r.json();
  const dados = JSON.parse(Buffer.from(j.content, 'base64').toString('utf8'));
  return { dados, sha: j.sha };
}

function limparLista(v) {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x) => typeof x === 'string')
    .map((x) => x.trim().slice(0, 140))
    .filter(Boolean)
    .slice(0, 60);
}

function limpar(d) {
  return {
    estudio: limparLista(d && d.estudio),
    raverlab: limparLista(d && d.raverlab),
    geral: limparLista(d && d.geral),
    feito: limparLista(d && d.feito),
  };
}

function hojeBR() {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date());
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method === 'GET') {
      const { dados } = await lerAtual();
      return res.status(200).json(dados);
    }
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
      if (!process.env.QUADRO_PIN || body.pin !== process.env.QUADRO_PIN) {
        return res.status(401).json({ ok: false, erro: 'pin' });
      }
      const dados = limpar(body.dados);
      dados.atualizado = hojeBR();
      const { sha } = await lerAtual();
      const conteudo = Buffer.from(JSON.stringify(dados, null, 1), 'utf8').toString('base64');
      const r = await fetch(`https://api.github.com/repos/${REPO}/contents/${PATH}`, {
        method: 'PUT',
        headers: { ...ghHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Atualiza o quadro (escrito na lousa)',
          content: conteudo,
          sha,
          branch: BRANCH,
        }),
      });
      if (!r.ok) throw new Error('github write ' + r.status);
      return res.status(200).json({ ok: true, dados });
    }
    return res.status(405).json({ ok: false });
  } catch (e) {
    return res.status(500).json({ ok: false, erro: String(e && e.message || e) });
  }
}
