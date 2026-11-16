import { readFile } from 'node:fs/promises'

import express from 'express'

const app = express()

app.use(express.json())

app.get('/api/health', (req, res) => {
  res.json({ ok: true })
})

// Teammates add their routes here (#120–#127)

//Tony Add

app.get('/api/applications', async (req, res) => 
  
  {


  try 
  
  {
    // Temporary source until 136 is merged

    const fileUrl = new URL(

      '../front-end/mocks/applications.json',

      import.meta.url

    )

    const fileContents = await readFile(fileUrl, 'utf8')

    const applications = JSON.parse(fileContents)

    if (!Array.isArray(applications)) 
      
      {

      return res.status(500).json(
        
        {

        error: 'Invalid applications data',

      }
    
    )

    }

    res.json(applications)

  } 
  
  catch (error) 
  
  {
    console.error('Failed to load applications:', error)

    res.status(500).json(
      
      {

      error: 'Unable to load applications',

    }
  
  )
  }
})


export default app
