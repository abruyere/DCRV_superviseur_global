const express = require('express')
const WebSocket = require('ws')
const app = express()
const port = 3000

app.get('/', (req, res) => res.send('Hello World!'))

app.listen(port, () => console.log(`Example app listening on port ${port}!`))

const server = new WebSocket.Server({
  port: 8000
});

// Socket permettant de stocker l'interface graphique
let interfaceSocket = null;
// Permet de stocker tous les sockets
let sockets = [];
// Tableau stockant les voitures
let voitures = [];
// la limite pour le mode drapeau jaune
let limite = 1;

// Cette fonction permet de chercher une voiture dans le tableau de toutes les voitures
// grâce à un id spécifié en paramètre
function recuperationVoiture(id){
  
  if(!id) return null;

  let voitureTrouvee = null;
  voitures.forEach(voiture => {
    if(voiture.id === id){
      voitureTrouvee = voiture;
    }
  })
  return voitureTrouvee;
}

// Cette fonction permet de récupérer un socket en fonction de l'id de la voiture
function getsocket(id){
  if(!id) return null;

  let socketTrouve = null;
  sockets.forEach(s => {
    if(s.id === id){
      socketTrouve = s.client;
    } 
  })
  return socketTrouve;
}

// Permet de supprimer une voiture dans les tableaux utiles pour la logique du code
function supprimerVoitureTableau(id){
  // On supprime la voiture du tableau des sockets
  sockets.forEach((s, index) => {
    if(s.id === id) sockets.splice(index,1);
  });
  // On supprime la voiture du tableau des voitures
  voitures.forEach((v, index) => {
    if(v.id === id) voitures.splice(index,1);
  });
}

// Permet de réinitialiser une voiture
function reinitialisationVoiture(voiture) {
  voiture.vitesse = 0;
  voiture.position = 0;
  voiture.tour = 0;
}

function drapeauToInt(drapeau){
  switch (drapeau) {
    case 'DRAPEAU_NOIR':
      return 0;  
    break;
    case 'DRAPEAU_VERT':
      return 1;  
    break;
    case 'DRAPEAU_JAUNE':
      return 2;  
    break;
    case 'DRAPEAU_ROUGE':
      return 3;  
    break;
    case 'DRAPEAU_NOIR_A_DAMIER':
      return 4;  
    break;
  }
}

function intToDrapeau(mode) {
  switch (mode) {
    case 0:
      return 'DRAPEAU_NOIR';  
    break;
    case 1:
      return 'DRAPEAU_VERT';
    break;
    case 2:
      return 'DRAPEAU_JAUNE';
    break;
    case 3:
      return 'DRAPEAU_ROUGE';
    break;
    case 4:
      return 'DRAPEAU_NOIR_A_DAMIER';  
    break;
  }
}

// Cette fonction est utile pour envoyer une donnée de vitesse compréhensible facilement par l'esp32 et le bas-niveaux
// On préfère les int que les floats
function vitesseToInt(vitesse) {
  return vitesse*100;
}

// On traduit la vitesse de 0 à 255 en -1 et 1
function convertionTrameToVitesse(vitesse){
  // On regarde si c'est entre 0 et 128 ou entre 128 et 255
  if(vitesse >= 0 && vitesse <= 128){
    vitesse = vitesse / 128;
    vitesse = vitesse -1;
  }
  else if(vitesse > 128 && vitesse <= 255){
    vitesse = vitesse - 128;
    vitesse = vitesse /128;
  }
}
// On traduit la vitesse de -1 à 1 en 0 à 255
function convertionVitesseToTrame(vitesse){
  // On regarde si c'est entre 0 et 128 ou entre 128 et 255
  if(vitesse >= -1 && vitesse <= 0){
    vitesse = vitesse + 1;
    vitesse = vitesse * 128;
  }
  else if(vitesse > 0 && vitesse <= 1){
    vitesse = vitesse * 128;
    vitesse = vitesse + 128;
  }
}

function envoieEtatVoiture(dataJson){
      
    // On recoit la vitesse angulaire de la part de la voiture en radian par secondes
    // Il faut calculer sa position angulaire en radian
    // Pour se faire, il faut prendre la position actuelle de la voiture et additionner avec
    // la vitesse angulaire multiplié par la période
    // ==> position de la voiture = position actuelle + (vitesse voiture * période)
    // Dans notre cas la voiture envoit sa vitesse toutes les 100ms
    // ex: Avec une période de 0.10 s(100ms), une vitesse de pi rad/s, position actuelle de 0 rad
    // positon = 0 + (pi * 0.10) = 0.10pi rad
      
    // Si l'interface de supervision n'est pas connectée on arrête
    if(!interfaceSocket) return;

    // On récupère la voiture
    let voiture = recuperationVoiture(dataJson.id);

    // Si on ne trouve pas la voiture on arrête
    if(!voiture) return;

    // On envoie l'état de la voiture au superviseur global si la voiture est au mode 2
    if(voiture.etat != 2 ) return;


    voiture.vitesse = dataJson.vitesse;
    console.log('Vitesse => ' + voiture.vitesse);

    // Vérifier si la position compris entre -1 et 1
    if(voiture.vitesse < -1) voiture.vitesse = -1;
    if(voiture.vitesse > 1) voiture.vitesse = 1;
      
    // On divise la vitesse pour aller moins vite sur le circuit, autrement c'est beaucoup trop rapide et ne ressemble pas à une vraie course
    dataJson.vitesse = dataJson.vitesse / 60;

    // Calcul de la poition
    let position = (voiture.position + (dataJson.vitesse * 0.10));
    console.log("position =>" + position); // DEBUG, A REGARDER DANS UN TERMINAL, VOIR DOC
    // La position s'exprime comme un chiffre compris entre 0 et 1
    if(position >= 1) position -= 1;
    if(position < 0) position += 1;

    // On regarde si la voiture a fait un tour de circuit               
    if(parseFloat(voiture.position).toFixed(2) == 0.99 && parseFloat(position).toFixed(2) == 1.00){
        // Si on a fait un tour
        // On incrémente le nombre de tours de la voiture
        voiture.tour ++;
    }

    voiture.position = position;

    // On envoie l'état de la voiture à l'interface de supervision
    interfaceSocket.send(JSON.stringify(voiture));
}

// Cette fonction est lancée lors d'une connexion au serveur de la part d'un client(une voiture)
server.on('connection', function(socket, req) {

  // On retire le premier caractère qui correspond à un '/'
  let id = null;
  if(req.url.substring(1)){
    id = req.url.substring(1);
  }

  // On donne un id pour le socket
  socket.id = id;

  // Une fois la connexion établie, on ajoute le client
  if(id === 'interface'){
    // Dans le cas où c'est l'interface graphique qui se connecte

    // On regarde si l'interface est déjà connectée
    // Si oui on arrête
    if(interfaceSocket) return;

    console.log('CONNECTE===>' + socket.id);// DEBUG, A REGARDER DANS UN TERMINAL, VOIR DOC

    // On stoke le socket de l'interface
    interfaceSocket = socket;
  }
  else if(id){

    // Dans le cas ù une voiture se connecte

    // Si l'interface n'est pas connectée on arrête la connexion de la voiture
    if(!interfaceSocket) return;

    // Si la voiture est déjà connectée on arrête
    if(recuperationVoiture(id)) return;

    console.log('CONNECTE===>' + socket.id);// DEBUG, A REGARDER DANS UN TERMINAL, VOIR DOC

    sockets.push({
      'client': socket,
      'id': id
    });

    // Ajout de la voiture dans un tableau, ce tableau sera envoyé à l'interface de supervision
    let voiture = {
      'id': id,
      'position': 0,
      'vitesse': 0,
      'etat': 1,
      'tour': 0
    }
    voitures.push(voiture);

    // Envoie de la voiture au serveur
    interfaceSocket.send(JSON.stringify(voiture));

    // On indique à la voiture qu'elle est connectée
    socket.send(JSON.stringify({
      'mode': 5,
      'etat': 1
    }));
  }

  socket.on('message', function(data) {

    // On sérialize les données reçues(string) en JSON
    let dataJson = JSON.parse(data);

    console.log(dataJson);// DEBUG, A REGARDER DANS UN TERMINAL, VOIR DOC

    // La voiture envoie le mode en int,
    // si on reçoit des données de la voiture on tradruit le int du mode en string pour le switch
    if(typeof dataJson.mode === 'number') dataJson.mode = intToDrapeau(dataJson.mode);

    // La voiture envoie une vitesse entre 0 et 255, nous on travaille en radian, on traduit la vitesse en -1 et 1
    //dataJson.vitesse = dataJson.vitesse / 100;
    dataJson.vitesse = convertionTrameToVitesse(dataJson.vitesse);

    // Selon le mode, on effetue une action
    switch (dataJson.mode) {

      case 'DRAPEAU_VERT':

        if(socket.id === 'interface'){
          // Envoie du changement de mode aux voitures
          server.clients.forEach(function each(client) {
            if (client !== socket && client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                'mode': drapeauToInt(dataJson.mode)
              }));
            }
          });
        }
        else{
          envoieEtatVoiture(dataJson);
        }
      break;

      case 'DRAPEAU_ROUGE':
        if(socket.id === 'interface'){
          // Envoie du changement de mode aux voitures
          server.clients.forEach(function each(client) {
            if (client !== socket && client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                'mode': drapeauToInt(dataJson.mode),
                'vitesse': 128
              }));
            }
          })
        }
      break;

      case 'DRAPEAU_JAUNE':
        if(socket.id === 'interface'){
          limite = parseFloat(dataJson.limite);
          // Envoie du changement de mode et de la limite aux voitures
          server.clients.forEach(function each(client) {
            if (client !== socket && client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                'mode': drapeauToInt(dataJson.mode),
                'limite': convertionVitesseToTrame(limite)
              }));
            }
          })
        }else{
          // On regarde la position de la voiture
          // dès que la voiture est arrivé au point de départ on l'arrête
          if(dataJson.vitesse > limite) dataJson.vitesse = limite;
          envoieEtatVoiture(dataJson);
        }
      break;

      case 'DRAPEAU_NOIR':
        if(socket.id === 'interface'){
          // On veut que les voitures roulent à la vitesse max pour retourner au point de départ
          let vitesseDrapeauNoir = 1;
          // Envoie du changement de mode aux voitures
          server.clients.forEach(function each(client) {
            if (client !== socket && client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                'mode': drapeauToInt(dataJson.mode),
                'vitesse': convertionVitesseToTrame(vitesseDrapeauNoir)
              }));
            }
          })
        }else{
          // On regarde la position de la voiture
          // dès que la voiture est arrivé au point de départ on l'arrête
          
          let voiture = recuperationVoiture(dataJson.id);

          // Si la voiture est déjà connectée on arrête
          if(!voiture) break;

          if(voiture.position.toFixed(2) !== '1.00'){
            envoieEtatVoiture(dataJson);
          }
          else{
            // Si on est arivé au point de départ on arrête la voiture si elle n'est pas déjà arrêtée
            if(voiture.vitesse === 0) return;
            socket.send(JSON.stringify({
              'mode': drapeauToInt(dataJson.mode),
              'vitesse': 0
            }));
            // On indique 
            dataJson.vitesse = 0
            envoieEtatVoiture(dataJson);
          }
        }
      break;

      case 'DRAPEAU_NOIR_A_DAMIER':
        if(socket.id === 'interface'){

          let vitesseConstante = parseFloat(dataJson.constante);
          // Envoie du changement de mode et de la vitesse constante aux voitures
          server.clients.forEach(function each(client) {
            if (client !== socket && client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                'mode': drapeauToInt(dataJson.mode),
                'vitesse': convertionVitesseToTrame(vitesseConstante)
              }));
            }
          })
        }else{
          envoieEtatVoiture(dataJson);
        }
      break;

      case 'DECONNEXION':
        // Dans le cas de l'appuie du bouton se déconnecter
        // Onferme tous les sockets
        sockets.forEach(s => {
          s.client.close();
          supprimerVoitureTableau(s.id);
        });
        interfaceSocket = null;
      break;

      case 'DECONNEXION_VOITURE':
        // Dans le cas de l'appuie au bouton de deconnexion d'une voiture
        // On ferme la connexion de la voiture
        let s = getsocket(dataJson.id);
        // On envoie à la voiture le changement d'état
        s.send(JSON.stringify({
          'mode': 5,
          'etat': 0
        }));
        // On ferme le socket
        s.close();
        // On supprime la voiture des tableaux
        supprimerVoitureTableau(dataJson.id);
      break;
      case 'CHANGER_ETAT':
        // On change l'état de la voiture
        let voiture = recuperationVoiture(dataJson.id)
        if(!voiture) break;
        // Si on enlève la voiture de la course on la réinitialise
        if((voiture.etat === 2 && dataJson.etat === 1)) {
          reinitialisationVoiture(voiture);
        }
        voiture.etat = dataJson.etat

        // On envoie à la voiture le changement d'état
        let sock = getsocket(voiture.id);
        sock.send(JSON.stringify({
          'mode': 5,
          'etat': voiture.etat
        }));
      break;
    }
  });

  // Evenement lors de la fermeture d'un socket
  socket.on('close', function() {
    console.log('CLOSE ===>' + socket.id);// DEBUG, A REGARDER DANS UN TERMINAL, VOIR DOC
      
    // Si c'est l'interface qui se déconnecte, on déconnecte tout
    if(socket.id === 'interface'){
      sockets.forEach(s => {
        s.client.close();
        supprimerVoitureTableau(s.id);
      });
      interfaceSocket = null;
    }

    // Si c'est une voiture on vérifie que l'interface est connecté
    if(!interfaceSocket) return;
      
    // On supprime la voiture des tableaux
    supprimerVoitureTableau(socket.id)
    
    // On envoie à l'interface graphique la voiture qui a été déconnectée
    // pour permettre de la griser surl'interface graphique
    interfaceSocket.send(JSON.stringify({
      'mode': 'DECONNEXION',
      'id': socket.id
    }))
  });
});
