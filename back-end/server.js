#!/usr/bin/env node
import server from './app.js'

const port = Number(process.env.PORT || 3000)
const resetDemo = process.env.PASSWORD_RESET_DEMO === '1' && process.env.NODE_ENV !== 'production'
const onListen = error => {
  if (error) throw error
  const actualPort = listener.address().port
  if (resetDemo) {
    server.locals.passwordResetDemo = {
      email: 'reset-demo@example.test',
      origin: 'http://127.0.0.1:' + actualPort,
      deliver: url => console.log('Demo password reset link: ' + url),
    }
  }
  console.log(`Server running on port: ${actualPort}`)
}
const listener = resetDemo ? server.listen(port, '127.0.0.1', onListen) : server.listen(port, onListen)

const close = () => {
  listener.close()
}

export { close }
