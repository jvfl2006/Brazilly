# Brazilly + Supabase (primeira integração)

Esta versão conecta o frontend do Brazilly ao Supabase para:

- Cadastro e login por e-mail e senha, com sessão persistente.
- Confirmação de e-mail e recuperação de senha.
- Perfil adulto (18+), edição e sincronização entre dispositivos.
- Interesses do perfil.
- Até seis fotos de perfil no Supabase Storage.
- Descoberta de perfis reais com filtros de idade, gênero, intenção, interesse, cidade, escolaridade, exercício e fotos.
- Preferências de conta sincronizadas (tema e papel de parede continuam locais; opções de privacidade e mídia ficam salvas no banco, mas só terão efeito completo quando presença/chat forem implementados).

## 1. Preparar o Supabase

1. Abra o projeto `brazilly` no painel Supabase.
2. Entre em **SQL Editor** → **New query**.
3. Abra `supabase/schema.sql`, copie todo o conteúdo, cole no editor e clique em **Run**.
4. Confira se a execução terminou sem erros. Isso cria tabelas, índices, políticas RLS, bucket de fotos e a função RPC de descoberta.

## 2. Configurar URLs de autenticação

No Supabase, abra **Authentication** → **URL Configuration**:

- **Site URL:** `https://brazilly.pages.dev`
- **Redirect URLs:** adicione `https://brazilly.pages.dev/**`

Mantenha a confirmação de e-mail habilitada. O frontend usa o endereço atual do site como destino dos links de confirmação e recuperação.

## 3. Publicar os arquivos

No repositório GitHub `brazilly`, substitua os arquivos da raiz:

- `index.html`
- `style.css`
- `script.js`

Não renomeie esses arquivos. O `index.html` carrega os outros dois por esses nomes. O Cloudflare Pages fará o deploy automático após o commit.

O arquivo `supabase/schema.sql` pode ficar no repositório como histórico da estrutura do banco. Ele não é executado automaticamente pelo Cloudflare.

## 4. Chaves e segurança

- A `Project URL` e a `Publishable key` já estão configuradas em `script.js`.
- A Publishable key é pública e pode estar no frontend.
- **Nunca** coloque `sb_secret_...`, `service_role`, senha do banco ou qualquer chave secreta no HTML, JavaScript, GitHub ou aplicativo Android.
- O banco usa Row Level Security (RLS). Dados privados do perfil só podem ser lidos diretamente pelo próprio usuário. A descoberta usa uma função RPC que retorna uma seleção limitada de campos públicos.
- As fotos ficam em um bucket público porque são fotos de perfil; o envio e a exclusão são limitados à pasta do próprio usuário.

## 5. Teste inicial

1. Abra `https://brazilly.pages.dev` depois que o deploy terminar.
2. Crie uma conta usando um e-mail seu e uma senha nova, exclusiva para o Brazilly.
3. Confirme o e-mail pelo link recebido.
4. Se o navegador não retomar o cadastro automaticamente, entre na conta e complete o perfil.
5. Adicione interesses e fotos e salve.
6. Para testar a descoberta, crie uma segunda conta com outro e-mail. Um perfil não aparece na descoberta para si próprio.

## O que ainda NÃO está conectado

Esta é a primeira camada real do backend, não a rede social completa. O chat ainda é demonstrativo local. Conversas, mensagens em tempo real, amizades, bloqueio/denúncia pela interface, localização precisa/distância, presença online efetiva, chamadas de vídeo, streaming, jogos e notificações push Android exigem etapas adicionais. As tabelas de bloqueio e denúncia já foram preparadas, mas ainda não há telas para operá-las.

Antes de divulgar publicamente, também será necessário implementar moderação, denúncia e bloqueio completos, política de privacidade/LGPD, exclusão de conta e controles de abuso/spam.