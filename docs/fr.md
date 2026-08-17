# Intégration Nginx Proxy Manager

Cette intégration connecte Gladys Assistant à votre instance
[Nginx Proxy Manager](https://nginxproxymanager.com/) (NPM), le gestionnaire de
reverse proxy avec interface web.

## Ce que fait l'intégration

- **Un appareil par proxy host** : chaque proxy host configuré dans NPM apparaît
  comme un appareil Gladys avec un interrupteur **Activé/Désactivé**. Vous
  pouvez activer ou couper un proxy host depuis le tableau de bord, une scène ou
  le chat — pratique pour couper temporairement l'accès à un service exposé.
- **Un appareil de supervision** « Nginx Proxy Manager » avec :
  - le nombre de proxy hosts, de redirections, de streams et d'hôtes 404 ;
  - le nombre de certificats SSL gérés ;
  - le nombre de jours avant l'expiration du prochain certificat (idéal pour
    déclencher une alerte via une scène).

## Prérequis

- Une instance Nginx Proxy Manager accessible **depuis le réseau de Gladys**
  (l'interface d'administration, port `81` par défaut).
- Un compte **administrateur** NPM (le même e-mail/mot de passe que pour
  l'interface web).

## Configuration

1. Installez l'intégration depuis le catalogue Gladys.
2. Dans l'écran de configuration, renseignez :
   - **URL de l'interface d'administration** : par exemple
     `http://192.168.1.10:81` (sans `/` final, l'URL que vous ouvrez dans votre
     navigateur) ;
   - **E-mail administrateur** et **Mot de passe administrateur** ;
   - **Intervalle de rafraîchissement** (optionnel, 60 s par défaut).
3. Enregistrez, puis cliquez sur **Tester la connexion** : la version de votre
   instance NPM et le nombre de proxy hosts s'affichent si tout est bon.
4. Lancez une recherche d'appareils : le serveur et tous vos proxy hosts
   apparaissent, il ne reste qu'à les ajouter à une pièce.

## Bon à savoir

- Désactiver un proxy host dans Gladys a le même effet que dans l'interface
  NPM : le domaine renvoie une erreur 502 tant qu'il est désactivé.
- Si vous ajoutez ou supprimez des proxy hosts dans NPM, relancez simplement
  une recherche d'appareils dans Gladys pour mettre la liste à jour.
- L'identifiant de chaque appareil est basé sur l'id interne NPM du proxy
  host : renommer un domaine dans NPM ne casse pas l'historique dans Gladys.
