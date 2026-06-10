# Relatório de Qualidade: postforme-mcp-pro

**Data:** 2026-06-10 · **Tipo:** MCP TypeScript · **Tools:** 27 + `postforme_raw`
**Revisores:** code-reviewer + security-reviewer (threshold 80% confiança)

## Resumo Executivo
| Dimensão | Status | Findings | Pós-correção |
|----------|--------|----------|--------------|
| Segurança (código) | ✅ | 2 médios (SSRF, file read) | corrigidos |
| Segurança (operacional) | ⚠️ | 1 crítico (chave real no `.env`) | ação do operador |
| Qualidade | ✅ | 5 (1 médio, 4 baixos) | corrigidos |
| Padrões MCP | ✅ | 0 | — |
| Documentação | ✅ | 0 | — |

## Certificado
### 🏆 CÓDIGO APROVADO PARA PRODUÇÃO — com 1 pendência operacional (rotacionar a chave)

Zero findings críticos ou altos de código. Tudo apontado com >80% de confiança foi corrigido e revalidado (SSRF testado contra 6 vetores de bypass, build limpo, boot OK).

## 🚨 Pendência crítica — ação do operador (não é bug de código)
**[C1] Chave real `pfm_live_...` no `.env`** (`.env:2`). Chave de produção em texto claro no disco, com poder de publicar nas contas conectadas. Contida hoje (`.gitignore` cobre, não é repo git, fora do `files` do npm), mas deve ser **rotacionada/revogada** após os testes; preferir injeção via `env` do `.mcp.json` ou chave de escopo restrito.

## Findings corrigidos

### Segurança
- **[M1] SSRF no `upload_media`** — `assertSafeRemoteUrl` reescrita: resolve DNS e valida todos os IPs com `ipaddr.js` (só `unicast` público passa), bloqueia redirects (`maxRedirects: 0`), teto de 256 MB. Defende contra DNS rebinding, metadata cloud (169.254.169.254), IP em decimal/octal/IPv4-mapped. Testado.
- **[M2] Leitura arbitrária de arquivo via `file_path`** — exige extensão de mídia conhecida, teto de tamanho, allowlist opcional `POSTFORME_MEDIA_DIR`.

### Qualidade
- `media_url` não cai mais em fallback que poderia conter o token de upload assinado (`media.ts`).
- `create_post_preview` deixou de ser `write` → utilizável em readonly (confirm-before-publish).
- `account_configurations` virou schema tipado compartilhado (create/update/preview consistentes).
- `create_webhook`/`update_webhook` validam URL `https://` localmente.
- `upload_media` não muta mais o input parseado.
- Versão do servidor MCP lida do `package.json` (sem divergência hardcoded).

## Residuais documentados (risco baixo, aceitáveis)
- **[R1]** `POSTFORME_BASE_URL` confiada do ambiente (OK em single-user).
- **[R4]** Respostas de conta retornam JSON cru — redigir `access_token`/`refresh_token` se a API os ecoar.
- **[R3]** Confirmação de ações destrutivas é via skill, não enforce; gate readonly correto.

## Pontos positivos (verificados)
Error handling acionável com hints por status · retry com backoff+jitter e `Retry-After` · `encodeURIComponent` em todos os path params · readonly gate correto (raw só libera GET) · conformidade MCP completa · `upload_media` em 2 passos tolerante a variações de payload · chave nunca logada · `uploadToSignedUrl` sem vazar o Bearer.

## Validação ao vivo (2026-06-10)
Smoke test com chave real: 31 contas conectadas; listas retornam `{ data, meta }`; `create-upload-url` retorna `{ upload_url, media_url }`; feeds e results (analytics) OK; webhooks OK.
