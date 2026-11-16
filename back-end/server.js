#!/usr/bin/env node
import server from './app.js'

const port = process.env.PORT || 3000

const listener = server.listen(port, () => {
  console.log(`Server running on port: ${port}`)
})

const close = () => {
  listener.close()
}

export { close }
