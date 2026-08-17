# Intégration Nginx Proxy Manager

Cette intégration connecte Gladys Assistant à votre instance
[Nginx Proxy Manager](https://nginxproxymanager.com/) (NPM), le gestionnaire de
reverse proxy avec interface web.

C'est une intégration volontairement **minimale** : elle ne crée aucun
appareil. Elle mémorise l'accès à votre instance NPM, vérifie que Gladys peut
s'y connecter, et vous donne un accès rapide au portail d'administration.

## Ce que fait l'intégration

- **Tester la connexion** : un bouton dans l'écran de configuration vérifie
  l'URL et les identifiants, puis affiche la version de votre instance NPM et
  le nombre de proxy hosts configurés.
- **Portail NPM** : un bouton qui affiche l'URL du portail d'administration
  que vous avez configurée, pour la retrouver en un clin d'œil depuis Gladys.
- L'état de la connexion (joignable ou non) est affiché en permanence dans
  l'écran de configuration de l'intégration.

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
   - **E-mail administrateur** et **Mot de passe administrateur**.
3. Enregistrez, puis cliquez sur **Tester la connexion** : la version de votre
   instance NPM s'affiche si tout est bon.

## Bon à savoir

- La gestion des proxy hosts (création, activation, certificats…) reste dans
  l'interface de Nginx Proxy Manager : utilisez le bouton **Portail NPM** pour
  retrouver son adresse.
- L'interface de Gladys ne peut pas ouvrir directement une page externe depuis
  une intégration : le bouton affiche donc l'URL à ouvrir dans votre
  navigateur.
