const express = require('express')
const { WebhookClient } = require('dialogflow-fulfillment')
const app = express()
const fetch = require('node-fetch')
const base64 = require('base-64')

let username = "";
let password = "";
let token = "";

USE_LOCAL_ENDPOINT = false;
// set this flag to true if you want to use a local endpoint
// set this flag to false if you want to use the online endpoint
ENDPOINT_URL = ""
if (USE_LOCAL_ENDPOINT){
ENDPOINT_URL = "http://127.0.0.1:5000"
} else{
ENDPOINT_URL = "https://mysqlcs639.cs.wisc.edu"
}



async function getToken () {
  let request = {
    method: 'GET',
    headers: {'Content-Type': 'application/json',
              'Authorization': 'Basic '+ base64.encode(username + ':' + password)},
    redirect: 'follow'
  }

  const serverReturn = await fetch(ENDPOINT_URL + '/login',request)
  const serverResponse = await serverReturn.json()
  token = serverResponse.token

  return token;
}

app.get('/', (req, res) => res.send('online'))
app.post('/', express.json(), (req, res) => {
  const agent = new WebhookClient({ request: req, response: res })

  //Welcome
  function welcome () {
    agent.add('Webhook works!')
    console.log(ENDPOINT_URL)
  }

  async function login () {
    username = agent.parameters.username // is this right?
    password = agent.parameters.password
    await getToken()
    agent.add("Logged you in with Username:" + username + " Password: "+ password)

    //do a PUT to the application endpoint 

    agent.add('Token:' + token)
  }

  async function queryCategories () {

    let request = { 
      method: 'GET'
    }
    const serverReturn = await fetch('https://mysqlcs639.cs.wisc.edu/categories',request)
    const data = await serverReturn.json()
    
    var answer = data.categories
    
    console.log(data.categories)
    agent.add("We sell lots of things! Categories include: " + answer)
  }

  
  let intentMap = new Map()
  intentMap.set('Default Welcome Intent', welcome)
  intentMap.set('Login', login) 
  intentMap.set('Query Categories', queryCategories)
  agent.handleRequest(intentMap)

})

app.listen(process.env.PORT || 8080)
