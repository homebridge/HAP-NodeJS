Fork readme
=============
This fork is mainly to reorganize how accessories are managed to conform to a more plugin like management.

In this fork, users can define their own accessories in: accessories/*name*_accessory.js files, where name is a short description of the accessory. All defined accessories get loaded on server start. The accessory is defined using an object literal notation.

This should simplify the creation and maintenance of accessories, because:
* a) all accessories are now defined independently of the HAP-NodeJS code
* b) each accessory hardware communication code can now be localized to the relevant *name*_accessory.js file instead of cluttering up the Core.js code, making updating cumbersome.

**Note**, that this is a work in progress, code is not yet completed / tested. Status: server starts normally and can advertises accessories. Next steps is to test the add process and test whether onUpdate functions are executed as expected.


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


