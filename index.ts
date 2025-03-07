import { StorageMonitor } from './StorageMonitor';
    
    const storageMonitor = new StorageMonitor();
    
    if (require('express')) {
      const app = require('express')();
      
      app.use('/api', storageMonitor.router);
      
      app.listen(3000, () => {
        console.log('Server running on port 3000');
      });
    }
