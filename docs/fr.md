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

Sur votre box/routeur, redirigez les ports 80 et 443 vers ces deux ports de la
machine Gladys pour que vos domaines et les challenges Let's Encrypt
fonctionnent.

## Bon à savoir

- Cette intégration ne crée aucun appareil dans Gladys : NPM se pilote depuis
  son propre portail.
- Arrêter l'intégration arrête aussi le proxy ; désinstaller l'intégration
  supprime le conteneur (les volumes suivent la politique de données de
  Gladys).
