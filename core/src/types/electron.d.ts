interface ElectronAPI {
    isElectron: boolean;
    platform: string;
    getWakeWordPath: (filename: string) => string;
  }
  
  declare global {
    interface Window {
      electron?: ElectronAPI;
    }
  }
  
  export {};