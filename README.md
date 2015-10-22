# ABDestination

![Capture d’écran](https://raw.githubusercontent.com/Watilin/ABDestination/master/capture.png)

ABDestination est un script utilisateur (*userscript*) pour le jeu en
ligne Alphabounce. Une fois installé, le jeu présente un nouvel onglet
(cf. capture ci-dessus) où vous pouvez entrer les coordonnées d’une
destination. Le script vous indique alors la distance à parcourir, une
estimation de la durée du voyage, ainsi que la direction à suivre.

## Comment l’utiliser

Ce script a été développé en utilisant
![](http://kergoz-panic.fr/watilin/userscripts/firefox16.png) Firefox et
le gestionnaire d’userscripts ![](http://kergoz-panic.fr/watilin/userscripts/greasemonkey16.png)
Greasemonkey. Sa compatibilité avec un autre navigateur ou un autre
gestionnaire d’userscripts n’est pas garantie.

Pour l’installer, suivez ces quelques instructions.

1. Si vous n’avez pas encore Greasemonkey, installez-le à partir de
[addons.mozilla.org](https://addons.mozilla.org/fr/firefox/addon/greasemonkey/).
2. Si Firefox vous demande de le redémarrer, faites-le.
3. Suivez ce lien : [ABDestination.user.js](https://raw.githubusercontent.com/Watilin/ABDestination/master/ABDestination.user.js).
Une fenêtre ressemblant à ceci devrait apparaître :
![fenêtre d’installation](https://raw.githubusercontent.com/Watilin/ABDestination/master/install.png)
Attendez la fin du décompte et cliquez sur *Installer*.
4. Un message vous indiquera que le script a été installé correctement.

## Données personnelles

Ce script stocke localement les données suivantes :

- votre position actuelle
- votre destination
- la puissance du moteur de votre enveloppe

C’est un stockage local : vos données ne sont jamais envoyées ni à
moi-même ni à un tiers. En raison de la faible quantité d’espace occupé,
je n’envisage pas pour l’instant de fournir aux utilisaeurs un moyen de
gérer finement ces données. À tout moment vous pouvez les supprimer en
supprimant le script depuis le panneau de gestion de Greasemonkey, qui
se trouve sur la page des addons de Firefox (`Ctrl+Maj+A`).