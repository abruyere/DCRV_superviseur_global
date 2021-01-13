const express = require('express')
const WebSocket = require('ws')
const app = express()
const port = 3000

app.get('/', (req, res) => res.send('Hello World!'))

app.listen(port, () => console.log(`Example app listening on port ${port}!`))

const server = new WebSocket.Server({
  port: 8000
});

let interfaceSocket = null;
let sockets = [];
// Tableau stockant l'état des voitures
let voitures = [];

// Cette fonction permet de chercher une voiture dans le tableau répertoriant toutes les voitures
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

// Cette fonction est lancé lors d'une connection au serveur de la part d'un client(une voiture)
server.on('connection', function(socket, req) {

  // On retire le premier caractère qui correspond à un '/'
  let id = null;
  if(req.url.substring(1)){
    id = req.url.substring(1);
  }

  // On donne un id pour le socket
  socket.id = id;

  // Une fois la connexion établie, on ajoute le client
  // Ajout du client dans un tableau
  if(id === 'interface'){

    // TODO: gérer le fait de ne pas se connecter plusieurs fois
    /*sockets.push({
      'socket_id': socket.id,
      'client': socket,
      'id': id
    });*/

    // On stoke le socket de l'interface
    interfaceSocket = socket;
  }
  else if(id){
    sockets.push({
      'client': socket,
      'id': id
    });

    // Ajout de la voiture dans un tableau, ce tableau sera envoyé à l'interface de supervision
    voitures.push({
      'id': id,
      'position': 0
    });
  }

  // DELETE console.log(sockets);

  socket.on('message', function(data) {

  // On transforme les données reçu(string) en JSON
  let dataJson = JSON.parse(data);
  // Selon le mode, on effetue une action
  switch (dataJson.mode) {

    case 'DRAPEAU_VERT':
      console.log('Le mode drapeau vert est activé, les utilisateurs ont la main sur les voitures');
      /*server.clients.forEach(function each(client) {
        if (client !== socket && client.readyState === WebSocket.OPEN) {
          client.send("test");
        }
      })*/
      /*voitures.forEach(v => {
        v.client.send(JSON.stringify({
          'mode': 'DRAPEAU_VERT'
        }));
      });*/
      server.clients.forEach(function each(client) {
        if (client !== socket && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            'mode': 'POSITION'
          }));
        }
      })
    break;
    case 'DRAPEAU_ROUGE':
      dataJson.vitesse = 0;
      server.clients.forEach(function each(client) {
        if (client !== socket && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(dataJson));
        }
      })
    break;
    case 'DRAPEAU_JAUNE':
      console.log("Le mode drapeau jaune est activé");
      server.clients.forEach(function each(client) {
        if (client !== socket && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(dataJson));
        }
      })
    break;
    case 'DRAPEAU_NOIR':
      console.log(socket.id);
      // Si on reçoit le message de l'interface graphique
      if(socket.id === 'interface'){
        server.clients.forEach(function each(client) {
          if (client !== socket && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(dataJson));
          }
        })
      }else{

      }
    //console.log(recuperationVoiture(socket.id));
    
      /*server.clients.forEach(function each(client) {
        if (client !== socket && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(dataJson));
        }
      })*/
    break;
    case 'DRAPEAU_NOIR_A_DAMIER':
      console.log("Le mode drapeau rouge est activé, les voitures vont s'rrêter");
      server.clients.forEach(function each(client) {
        if (client !== socket && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(dataJson));
        }
      })
    break;
    case 'POSITION':

      // Si l'interface graphique n'est pas activé on ne fait rien
      if(!interfaceSocket) break;

      // On reçu la vitesse angulaire de la part de la voiture
      // Il faut calculer sa position angulaire
      // Pour se faire, il faut prendre la position actuelle de la voiture et additionner avec
      // la vitesse angulaire multiplié par la période
      // ==> position de la voiture = position actuelle + (vitesse voiture * période)
      // ex: Avec une période de 0.05 s, une vitesse de pi rad/s, position actuelle de 0 rad
      // positon = 0 + (pi * 0.05) = 0.05pi rad
      
      // On récupère la voiture
      // TODO: gérer les erreurs
      let voiture = recuperationVoiture(dataJson.id);
      
      // Calcul
      let position = voiture.position + (dataJson.vitesse * 0.05);
      // La position s'exprime comme un chiffre compris entre 0 et 1
      if(position >= 1) position -= 1;
      if(position < 0) position += 1;
      voiture.position = position;

      interfaceSocket.send(JSON.stringify(voiture));
    break;
    case 'DECONNEXION':
      server.clients.forEach(function each(client) {
        if (client.readyState === WebSocket.OPEN) {
          client.close();
        }
      })
    break;
    default:
      break;
  }
  });

  // When a socket closes, or disconnects, remove it from the array.
  socket.on('close', function() {
    // On envoie à l'interface graphique la voiture qui a été déconnecter
    // pour permettre de l'effacer
    interfaceSocket.send(JSON.stringify({
      'mode': 'DECONNEXION',
      'id': socket.id
    }))
  });
});
