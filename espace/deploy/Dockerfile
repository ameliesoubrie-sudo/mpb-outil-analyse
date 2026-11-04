# Serveur de l'outil d'analyse (bilan.monphotographebebe.fr). Construit depuis la racine du dossier espace/ :
#   docker build -f deploy/Dockerfile -t mpb-outil-analyse .
FROM node:22.12-alpine
ENV NODE_ENV=production PORT=8080 HOST=0.0.0.0
WORKDIR /app
COPY serveur/package.json serveur/package-lock.json ./serveur/
RUN cd serveur && npm ci --omit=dev --no-audit --no-fund
COPY serveur/src ./serveur/src
COPY public ./public
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8080/sante || exit 1
CMD ["node", "serveur/src/index.js"]
