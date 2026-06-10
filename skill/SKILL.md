---
name: postforme
description: Publica, agenda, edita e analisa posts em todas as redes sociais conectadas ao Post for Me (Instagram, Facebook, TikTok, YouTube, X, LinkedIn, Pinterest, Bluesky, Threads) via MCP postforme-mcp-pro. Use quando o usuário pedir para postar, agendar, criar rascunho, subir mídia, puxar métricas/analytics, gerenciar contas conectadas, ou rodar uma campanha multi-rede. Triggers - /postforme, "postar no instagram", "publicar nas redes", "agendar post", "agendar publicação", "criar rascunho", "subir foto/vídeo", "publicar carrossel", "analytics das redes", "métricas do post", "como foi o post", "conectar conta", "listar contas conectadas", "rodar campanha", "post for me".
---

# /postforme — Publicação e analytics multi-rede via Post for Me

Esta skill orquestra o MCP **postforme-mcp-pro** para todo o ciclo de vida de conteúdo nas 9 redes que o Post for Me conecta: **Instagram, Facebook, TikTok, YouTube, X, LinkedIn, Pinterest, Bluesky, Threads**.

As tools do MCP fazem o trabalho (chamadas `list_social_accounts`, `create_post`, `schedule_post`, `upload_media`, `list_post_results`, etc.). A skill adiciona o **contexto e os fluxos**: descobrir contas, montar o post certo por plataforma, confirmar antes de publicar e resumir resultados.

## Pré-requisitos

1. **MCP ativo:** o servidor `postforme-mcp-pro` precisa estar configurado no client (com `POSTFORME_API_KEY`). Se as tools `list_social_accounts` etc. não existirem, peça ao usuário para adicionar o MCP (ver README do projeto).
2. **Contas conectadas:** rode `list_social_accounts` no início de qualquer fluxo de publicação para obter os `social_accounts` (ids). Nunca invente ids.
3. **Modo seguro:** se o usuário só quer consultar/analisar, lembre que `POSTFORME_READONLY=true` bloqueia qualquer escrita — bom para sessões de análise.

> Toda publicação é uma ação **outward-facing** (vai pro público real). **Sempre confirme com o usuário** o texto, as mídias e as contas-alvo antes de chamar uma tool de escrita (`create_post`, `publish_now`, `schedule_post`).

## Modos

A skill aceita um modo opcional: `/postforme [modo]`. Sem modo, infira pelo pedido.

### `post` — publicar agora
1. `list_social_accounts` → mostre as contas e pergunte em quais publicar (a menos que o usuário já tenha dito).
2. Se houver imagem/vídeo: `upload_media` (passe `file_path` local ou `source_url`) e use o `media_url` retornado.
3. (Opcional, recomendado) `create_post_preview` para mostrar como vai ficar em cada rede.
4. **Confirme** caption + mídia + contas com o usuário.
5. `publish_now` com `social_accounts`, `caption`, `media`.
6. Depois, `list_post_results` (filtrando por `social_post_id`) e **resuma** sucesso/erro por plataforma com os links nativos.

### `schedule` — agendar
- Igual ao `post`, mas use `schedule_post` com `scheduled_at` em **ISO-8601** (ex: `2026-07-01T14:30:00Z`). Converta o horário que o usuário disser (ex: "amanhã 9h") para ISO, confirmando o fuso.
- Para remarcar: `reschedule_post`. Para revisar a fila: `list_posts` com `status='scheduled'`.

### `campaign` — campanha multi-post / multi-rede
- O usuário traz vários posts ou uma série. Para cada um, monte o `create_post` (ou `schedule_post`) apropriado.
- Use `platform_configurations` para adaptar por rede no mesmo post (ex: caption mais curta no X, Reels no Instagram, título no YouTube). Um único `create_post` com vários `social_accounts` já distribui para todas as redes.
- Apresente um plano em tabela (post × rede × horário) e só execute após **aprovar**.

### `analytics` — métricas e desempenho
Duas fontes complementares:
- **`list_post_results`** → resultado de publicação por post/plataforma (sucesso, id/URL nativo, erro). Bom para "como foi o post X".
- **`list_account_feeds`** (por `social_account_id`) → feed recente da conta com métricas de engajamento. Bom para "como está indo a conta Y".
Resuma em linguagem natural: o que performou, o que falhou, próximos passos. Não despeje JSON cru — interprete.

### `accounts` — gerenciar conexões
- Listar: `list_social_accounts` (filtre por `platform`). Detalhe: `get_social_account`.
- Conectar nova rede: `create_auth_url` → entregue a URL para o usuário autorizar no navegador; depois confirme com `list_social_accounts`.
- Desconectar: `disconnect_social_account` (confirme antes — é destrutivo para a integração).

### `media` — subir mídia
- `upload_media` aceita `file_path` (arquivo local) **ou** `source_url` (URL pública). Retorna `media_url` pronto para o array `media` de um post.
- Para fluxos avançados (upload manual em 2 passos), use `create_media_upload_url`.

## Boas práticas por plataforma (`platform_configurations`)

Use o campo `platform_configurations` no `create_post`/`schedule_post` para ajustar por rede sem criar posts separados:

- **Instagram:** placement (`reels` | `stories` | `timeline`), `share_to_feed`, colaboradores. Reels exige vídeo.
- **TikTok:** `privacy_level`, `disable_comment`/`duet`/`stitch`, `title`.
- **YouTube:** `title`, `visibility` (`public`/`unlisted`/`private`), `made_for_kids`. Mídia = vídeo.
- **X:** enquete (`poll`), `reply_settings`, quote tweet. Atenção ao limite de caracteres — encurte a caption via `platform_configurations.x.caption`.
- **Pinterest:** `board_ids`, `link`, `title`.

Quando a opção for nova/desconhecida, o campo é permissivo — passe o objeto que a doc do Post for Me indicar (https://api.postforme.dev/docs). Em último caso, use `postforme_raw`.

## Regras

- **Confirmar antes de publicar.** Aprovação para um post não vale para o próximo.
- **Nunca imprimir a API key.** Referencie só como `POSTFORME_API_KEY`.
- **Ids reais sempre.** Obtenha `social_accounts` via `list_social_accounts`; obtenha ids de post via `list_posts`/`create_post`. Não invente.
- **Reporte fielmente.** Se um post falhou em uma rede (visto em `list_post_results`), diga claramente — não afirme sucesso geral.
- **Datas em ISO-8601 UTC.** Converta horários relativos e confirme o fuso com o usuário.
