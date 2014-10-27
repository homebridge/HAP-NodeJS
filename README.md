HAP-NodeJS
=============
HAP-NodeJS is a Node.js implementation of HomeKit Accessory Server.

With this project, you should be able to create your own HomeKit Accessory on Raspberry Pi, Intel Edison or any other platform that can run Node.js :)

The implementation may not 100% follow the HAP MFi Specification since MFi program doesn't allow individual developer to join. 

Remember to run `npm rebuild` before actually running the server.

You can use the following command to start the HAP Server:
  ```js
  node Core.js
  ```

Special thanks to [Alex Skalozub](https://twitter.com/pieceofsummer), who reverse engineered the server side HAP. You can find his research at [here](https://gist.github.com/pieceofsummer/13272bf76ac1d6b58a30).

[There](http://instagram.com/p/t4cPlcDksQ/) is a video demo running this project on Intel Edison.

If you are interested in HAP over BTLE, you might want to check [this](https://gist.github.com/KhaosT/6ff09ba71d306d4c1079).
