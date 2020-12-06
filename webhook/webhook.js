const express = require('express')
const { WebhookClient } = require('dialogflow-fulfillment')
const app = express()
const fetch = require('node-fetch')
const base64 = require('base-64')
const e = require('express')

let username = "";
let password = "";
let token = "";
let currProductName = "";
let messageId = 0; 
let isLoggedIn; 

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

  async function login() {
    // Reset the messages id
    messageId = 0
    // You need to set this from username entity that you declare in DialogFlow
    username = agent.parameters.username
    // You need to set this from password entity that you declare in DialogFlow
    password = agent.parameters.password

    await getToken()

    if (token != undefined) {
      isLoggedIn = true;

      let request = {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-access-token': token
        },
        body: JSON.stringify({
          back: false,
          dialogflowUpdated: true,
          page: "/" + username
        })
      }
      let serverReturn = await fetch(ENDPOINT_URL + '/application', request)
      let data = await serverReturn.json()

      agent.add("You've successfully logged in, " + username + "!")
      postMessage(new Date(), false, "You've successfully logged in, " + username + "!")
      agent.add("Welcome to the WiscShop! I am your shopping assistant, and I can help you with everything from finding certain items, keeping track of your cart, navigating the site, and more! I love to shop and I love to help!")
      postMessage(new Date(), false, "Welcome to the WiscShop! I am your shopping assistant, and I can help you with everything from finding certain items, keeping track of your cart, navigating the site, and more! I love to shop and I love to help!")

      // Clear the old messages
    } else {
      postMessage(new Date(), false, "Incorrect username or password, try again.")
      agent.add("Incorrect username or password, try again.")
    }
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
    postMessage(new Date(), false, "We sell lots of things! Categories include: " + answer)

  }

  async function queryTags(){
    let request = { 
      method: 'GET'
    }
    const serverReturn = await fetch(ENDPOINT_URL+'/categories/'+agent.parameters.category + '/tags',request)
    const data = await serverReturn.json()
    var answer = data.tags
    var num = answer.length
    if(answer==undefined){
      agent.add("Sorry, it looks like we don't carry any " + agent.parameters.category+".")
    }
    else{
    agent.add("There are " + num + " tags for "+ agent.parameters.category+  ", which include: " + answer + ".") 
    }
  }

  async function narrowTags(){
    category = agent.parameters.category
    tag = agent.parameters.tag

    let request = {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-access-token': token
      },
      body: JSON.stringify({
        back: false,
        dialogflowUpdated: true,
        page: "/categories'
      })
    }
    let serverReturn = await fetch(ENDPOINT_URL + '/application', request)
    let data = await serverReturn.json()

    agent.add("Filtered.")

  }

  async function queryCart(){
    let request = { 
      method: 'GET',
      headers: 
          {'Content-Type': 'application/json',
            'Authorization': 'Basic '+ base64.encode(username + ':' + password),
            'x-access-token': token}
    }
    const serverReturn = await fetch('https://mysqlcs639.cs.wisc.edu/application/products',request)
    const data = await serverReturn.json()
    cartProducts = data.products
    console.log(data.products)
    var numItems = 0;
    var totalCost = 0; 
    for (item in data.products){
      numItems += cartProducts[item].count
      totalCost += cartProducts[item].price * cartProducts[item].count
    }
    agent.add("Your cart has " + numItems + " items with a total of $" + totalCost+".") 
  }

  async function queryProduct(){

    agent.add("We have that in stock! Pulling up reviews for you...")

    let request = { 
      method: 'GET',
      headers: {'Content-Type': 'application/json'}
    }
    let serverReturn = await fetch(ENDPOINT_URL+'/products',request)
    let data = await serverReturn.json()
    allProducts = data.products;
    var inStock = false; 

    // first look to see that this product exists in our directory 
    for(product in allProducts){
      if(allProducts[product].name == agent.parameters.product){
        currProductId = allProducts[product].id
        agent.add("We've got it in stock!")
          
        //GET request to get info about reviews and ratings 
          let request = { 
            method: 'GET',
            headers: {'Content-Type': 'application/json'}
          }
          const serverReturn = await fetch(ENDPOINT_URL+'/products/'+currProductId + '/reviews',request)
          const data = await serverReturn.json()
          allProducts = data.products;
          
          let totalRating, numReviews = 0
          for (item in allProducts){
            totalRating += allProducts[item].stars
            numReviews += 1
          }
          avgRating = totalRating/numReviews

        agent.add("We've got it in stock. It has an average rating of "+ avgRating + " and " + numReviews + " reviews.")
        inStock = true
      }
    } 

    //this product doesn't exist. 
    if(!inStock){
      agent.add("Sorry, we don't have that.")
    }
  }

  //followup intent for previous function this will tell user about a  prduct's reviews/avg ratings
  async function queryReviews(){
    const context = agent.context.get(contextName)
    const productName = context.parameters.product

    let request = { 
      method: 'GET',
      headers: {'Content-Type': 'application/json'}
    }

    const serverReturn = await fetch(ENDPOINT_URL+'/products',request)
    const data = await serverReturn.json()
    allProducts = data.products;

    // first look to see that this product exists in our directory 
    for(product in allProducts){
      if(allProducts[product].name == productName){
        currProductId = allProducts[product].id
      }
    } 
  }

  async function navigatePage(){
    getToken()
    let category = agent.parameters.page

    let request = { 
      method: 'PUT',
      headers: 
        {'Content-Type': 'application/json', 
        'x-access-token':token}, 
      body: JSON.stringify(
      {
        "back": false,
        "dialogflowUpdated": true,
        "page": '/'+username+'/'+category
      })
    }
    let serverReturn = await fetch(ENDPOINT_URL + '/application',request)
    let data = await serverReturn.json()

    if(data.message==='Application state modified!'){
      postMessage(new Date(), false, "Here are the "+ category + ".")
      agent.add("Here are the "+ category + ".")
    }else{
      postMessage(new Date(), false, "Sorry, I couldn't find any "+ category + ".")
      agent.add("Sorry, I wasn't able to find that page. Could you try again?")
    }

  }

  async function navigateHome(){
    let request = { 
      method: 'PUT',
      headers: 
        {'Content-Type': 'application/json', 
        'x-access-token':token}, 
      body: JSON.stringify(
      {
        "back": false,
        "dialogflowUpdated": true,
        "page": '/'+username
      })
    }
    let serverReturn = await fetch(ENDPOINT_URL + '/application',request)
    let data = await serverReturn.json()

    if(data.message==='Application state modified!'){
      postMessage(new Date(), false, "Taking you to the home page.")
      agent.add("Taking you to the home page.")
    }else{
      postMessage(new Date(), false, "Sorry, I wasn't able to do that.")
      agent.add("Sorry, I wasn't able to do that. Could you try again?")
    }
  }

  async function postMessage(date, isUser, text){

    console.log("Posted a message right now with text:" + text)
    messageId += 1

    let request={
      method:'POST',
      headers:{
        'Content-type': 'application/json',
        'x-access-token': token
      },
      body: JSON.stringify({
        id: messageId,
        date: date.toString(), 
        isUser: isUser,
        text: text
      })
    }
    await fetch(ENDPOINT_URL, +'/application/messages', request)
  }

  async function clearMessages() {
    let request = {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'x-access-token': token
      }
    }
    await fetch(ENDPOINT_URL + '/application/messages', request)
  }
  
  let intentMap = new Map()
  intentMap.set('Default Welcome Intent', welcome)
  intentMap.set('Login', login) 
  intentMap.set('Query Categories', queryCategories)
  intentMap.set('Tags Query', queryTags)
  intentMap.set('Cart Query', queryCart)
  intentMap.set('Product Query', queryProduct)
  intentMap.set('Product Query - yes', queryReviews)
  intentMap.set('Pages Navigation', navigatePage)
  intentMap.set('Home Navigation', navigateHome)
  intentMap.set('Narrow Tags', narrowTags)

  agent.handleRequest(intentMap)

})

app.listen(process.env.PORT || 8080)
