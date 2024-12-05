rm -rf dist* &&
npm run build && 
zip -r dist.zip dist &&
scp dist.zip epc_staging:~ &&
ssh epc_staging "sudo unzip -o ~/dist.zip && \
sudo rm -rf ~/easy-pest-control-api/dist/ && \
sudo mv dist ~/easy-pest-control-api&& \
sudo rm ~/dist.zip" &&
rm dist.zip