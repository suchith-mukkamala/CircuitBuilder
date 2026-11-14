import {defineConfig} from '@playwright/test';
import process from 'node:process';

export default defineConfig({
  testDir:'./e2e',
  fullyParallel:true,
  workers:2,
  timeout:30000,
  use:{
    baseURL:'http://127.0.0.1:5173',
    trace:'retain-on-failure',
    screenshot:'only-on-failure',
    launchOptions:{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH},
  },
  projects:[
    {name:'desktop',use:{viewport:{width:1440,height:1000}}},
    {name:'phone',use:{viewport:{width:390,height:844},isMobile:true,hasTouch:true}},
  ],
  webServer:{command:'npm run dev -- --host 127.0.0.1 --port 5173',url:'http://127.0.0.1:5173',reuseExistingServer:!process.env.CI},
});
