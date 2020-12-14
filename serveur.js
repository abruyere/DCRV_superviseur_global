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
server.on('connection', function(socket, req) {
  
  // On retire le premier caractère qui correspond à un '/'
  const id = req.url.substring(1);

  // Une fois la connexion établie, on ajoute le client avec son id
  sockets.push({
    'id': id,
    'client': socket
  });

  // On stoke le socket de l'interface
  if(id === 'interface') interfaceSocket = socket;
  //console.log(interfaceSocket);

  //console.log(sockets);

  // When you receive a message, send that message to every socket.
  socket.on('message', function(data) {
  let dataJson = JSON.parse(data);
  switch (dataJson.mode) {
    case 'DRAPEAU_VERT':
      console.log('Le mode drapeau vert est activé, les utilisateurs ont la main sur les voitures');
      /*server.clients.forEach(function each(client) {
        if (client !== socket && client.readyState === WebSocket.OPEN) {
          client.send("test");
        }
      })*/
      sockets.forEach(s => {
        s.client.send(JSON.stringify({
          'mode': 'DRAPEAU_VERT'
        }));
      });
    break;
    case 'DRAPEAU_ROUGE':
      console.log("Le mode drapeau rouge est activé, les voitures vont s'rrêter");
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
      console.log("Le mode drapeau rouge est activé, les voitures vont s'rrêter");
      server.clients.forEach(function each(client) {
        if (client !== socket && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(dataJson));
        }
      })
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
      interfaceSocket.send(dataJson.position);
    break;
    default:
      break;
  }
  });

  // When a socket closes, or disconnects, remove it from the array.
  socket.on('close', function() {
    sockets = sockets.filter(s => s !== socket);
  });
});
