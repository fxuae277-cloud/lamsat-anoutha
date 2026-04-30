# Print Service Has Moved

The local print service has been extracted to its own repository:
https://github.com/fxuae277-cloud/lamsa-print-service

All future development should happen in that repo.

## Installation on cashier:
```bat
git clone https://github.com/fxuae277-cloud/lamsa-print-service.git C:\Users\mcc\lamsat\local-print-service
```

## Updates on cashier:
```bat
cd C:\Users\mcc\lamsat\local-print-service
git pull
npm install
npm run build
nssm restart LamsaPrintService
```
