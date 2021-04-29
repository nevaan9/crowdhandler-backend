const express = require('express')
const app = express()
const port = process.env.PORT || 3000


let creds
try {
    const credsJson = require('./credentials/creds.json')
    creds = credsJson['chPk']
} catch (e) {
    console.log(e)
}
app.get('/', (req, res) => {
  const msg = `HELLO ${creds || 'Not Found'}`
  res.send(msg)
})

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})