rm -rf dist* &&
npm run build && 
zip -r dist.zip dist &&
scp dist.zip epc_prod:~ &&
ssh epc_prod "sudo unzip -o ~/dist.zip && \
sudo rm -rf ~/easy-pest-control-api/dist/ && \
sudo mv dist ~/easy-pest-control-api&& \
sudo rm ~/dist.zip" &&
rm dist.zip