# Intégration Nginx Proxy Manager

Cette intégration **installe et fait tourner
[Nginx Proxy Manager](https://nginxproxymanager.com/)** (NPM) directement sur
la machine de Gladys : rien à installer à la main, pas de docker-compose à
écrire. Gladys crée le conteneur, le supervise, conserve ses données et vous
donne un accès direct à son portail web. (L'image utilisée est une version
très légèrement adaptée de l'image officielle, nécessaire pour fonctionner
dans le bac à sable sécurisé de Gladys — mêmes fonctionnalités.)

## Ce que fait l'intégration

- **Installation automatique** : à l'installation de l'intégration, Gladys
  télécharge l'image officielle de NPM et démarre le conteneur (l'équivalent
  de son docker-compose, dans le bac à sable de Gladys).
- **Supervision** : l'état du conteneur est visible dans Gladys ; l'écran de
  configuration affiche si l'API de NPM répond, et un bouton **Vérifier Nginx
  Proxy Manager** affiche la version en cours.
- **Accès au portail** : un lien **Ouvrir** dans Gladys mène au portail
  d'administration de NPM. La gestion (proxy hosts, redirections, certificats
  SSL) se fait dans ce portail, comme d'habitude.
- **Données persistantes** : la base de NPM (`/data`) et ses certificats
  (`/etc/letsencrypt`) sont conservés par Gladys entre les redémarrages et les
  mises à jour.

## Installation

1. Installez l'intégration depuis le catalogue Gladys. L'écran d'installation
   affiche le conteneur qui sera créé (image, ports publiés, limites) ;
   validez.
2. Attendez que l'état passe au vert (le premier démarrage initialise la base
   de NPM, comptez une à deux minutes).
3. Ouvrez le portail via le lien **Ouvrir** (ou l'URL affichée dans la section
   « Accéder au portail »).
4. À la première visite, Nginx Proxy Manager vous demande de créer le compte
   administrateur (e-mail + mot de passe de votre choix).

## Exposer vos services sur internet

Gladys choisit les ports publiés sur la machine (ils sont affichés dans
l'écran de configuration, sections « Exposer vos services ») :

- le port **HTTP** correspond au port 80 interne de NPM ;
- le port **HTTPS** correspond au port 443 interne.

Sur votre box/routeur :

- **Redirigez le port 443** (vers le port HTTPS assigné) : c'est le seul
  indispensable. Vos sites sont servis chiffrés, et personne ne peut lire ce
  qui transite.
- **Le port 80 est optionnel** (vers le port HTTP assigné) et ne doit jamais
  servir vos sites en clair. Il n'a que deux usages légitimes :
  - permettre à Let's Encrypt de vérifier votre domaine pour délivrer et
    renouveler vos certificats (c'est sa méthode par défaut) ;
  - rediriger automatiquement les visiteurs qui tapent `http://` vers
    `https://`.

  Si vous l'ouvrez, activez l'option **Force SSL** sur chacun de vos proxy
  hosts dans NPM : tout ce qui arrive en HTTP est alors immédiatement
  redirigé vers HTTPS, rien n'est servi en clair.

- Si vous préférez **ne pas ouvrir le port 80 du tout** : dans NPM, demandez
  vos certificats avec un **défi DNS** (« Use a DNS Challenge » à la demande
  du certificat) — Let's Encrypt vérifie alors votre domaine sans passer par
  le port 80.

## Où sont mes données ?

Les données de Nginx Proxy Manager vivent sur la machine qui héberge Gladys,
dans le dossier de données de l'intégration :

```
/var/lib/gladysassistant/external-integrations/<identifiant>/containers/npm/
├─ data/               # base SQLite (proxy hosts, comptes, réglages),
│                      # configurations nginx générées, logs
└─ etc/letsencrypt/    # certificats Let's Encrypt et clés de compte
```

(`<identifiant>` dépend de votre installation — visible avec
`docker inspect` sur le conteneur `npm`, colonne des montages.)

Ces dossiers survivent aux redémarrages et aux mises à jour. En revanche,
**désinstaller l'intégration peut les supprimer** : faites une copie avant
toute désinstallation, et incluez ce chemin dans vos sauvegardes habituelles :

```bash
sudo tar czf ~/backup-npm-$(date +%F).tar.gz \
  /var/lib/gladysassistant/external-integrations/*/containers/npm
```

## Bon à savoir

- Cette intégration ne crée aucun appareil dans Gladys : NPM se pilote depuis
  son propre portail.
- Arrêter l'intégration arrête aussi le proxy ; désinstaller l'intégration
  supprime le conteneur (les volumes suivent la politique de données de
  Gladys).
