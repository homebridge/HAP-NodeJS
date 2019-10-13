import { Accessory, Categories, uuid } from '..';
import { ButtonState, ButtonType, HomeKitRemoteController } from "../lib/HomeKitRemoteController";
import * as http from "http";
import url, { UrlWithParsedQuery } from "url";

const remoteUUID = uuid.generate('hap-nodejs:accessories:remote');

const remote = exports.accessory = new Accessory('Remote', remoteUUID);

// @ts-ignore
remote.username = "DB:AF:E0:5C:69:76";
// @ts-ignore
remote.pincode = "874-23-897";
remote.category = Categories.TARGET_CONTROLLER;

const controller = new HomeKitRemoteController();
controller.addServicesToAccessory(remote);

/*
    This example plugin exposes an simple http api to interact with the remote and play around.
    The supported routes are listed below. The http server runs on port 8080 as default.
    This example should not be used except for testing as the http server is unsecured.

    /press?button=<buttonId>&time=<timeInMS>  - presses a given button for a given time. Time is optional and defaults to 200
    /button?button=<buttonId>&state=<stateId>  - send a single button event
    /getTargetId?name=<name of apple TV>  -   get the target identifier for the given name of the apple tv
    /setActiveTarget?identifier=<id>  - set currently controlled apple tv

    /listTargets  -  list all currently configured apple tvs and their respective configuration
    /getActiveTarget  -  return the current target id of the controlled device
    /getActive  -  get the value of the active characteristic
    /setActive  -  set the value of the active characteristic (HomeKit seems to set the accessory active itself after configuration)
 */

http.createServer((request, response) => {
    if (request.method !== "GET") {
        response.writeHead(405, {"Content-Type": "text/html"});
        response.end("Method Not Allowed");
        return;
    }

    const parsedPath: UrlWithParsedQuery = url.parse(request.url!, true);
    const pathname = parsedPath.pathname!.substring(1, parsedPath.pathname!.length);
    const query = parsedPath.query;

    if (pathname === "setActiveTarget") {
        if (query === undefined || query.identifier === undefined) {
            response.writeHead(400, {"Content-Type": "text/html"});
            response.end("Bad request. Must include 'identifier' in query string!");
            return;
        }

        const targetIdentifier = parseInt(query.identifier as string, 10);
        if (!controller.isConfigured(targetIdentifier)) {
            response.writeHead(400, {"Content-Type": "text/html"});
            response.end("Bad request. No target found for given identifier " + targetIdentifier);
            return;
        }

        controller.setActiveIdentifier(targetIdentifier);
        response.writeHead(200, {"Content-Type": "text/html"});
        response.end("OK");
        return;
    } else if (pathname === "getActiveTarget") {
        response.writeHead(200, {"Content-Type": "text/html"});
        response.end(controller.activeIdentifier + "");
        return;
    } else if (pathname === "getTargetId") {
        if (query === undefined || query.name === undefined) {
            response.writeHead(400, {"Content-Type": "text/html"});
            response.end("Bad request. Must include 'name' in query string!");
            return;
        }

        const targetIdentifier = controller.getTargetIdentifierByName(query.name as string);
        if (targetIdentifier === undefined) {
            response.writeHead(400, {"Content-Type": "text/html"});
            response.end("Bad request. No target found for given name " + query.name);
            return;
        }

        response.writeHead(200, {"Content-Type": "text/html"});
        response.end("" + targetIdentifier);
        return;
    } else if (pathname === "button") {
        if (query === undefined || query.state === undefined || query.button === undefined) {
            response.writeHead(400, {"Content-Type": "text/html"});
            response.end("Bad request. Must include 'state' and 'button' in query string!");
            return;
        }

        const buttonState = parseInt(query.state as string, 10);
        const button = parseInt(query.button as string, 10);
        if (ButtonState[buttonState] === undefined) {
            response.writeHead(400, {"Content-Type": "text/html"});
            response.end("Bad request. Unknown button state " + query.state);
            return;
        }
        if (ButtonType[button] === undefined) {
            response.writeHead(400, {"Content-Type": "text/html"});
            response.end("Bad request. Unknown button " + query.button);
            return;
        }

        if (buttonState === ButtonState.UP) {
            controller.releaseButton(button);
        } else if (buttonState === ButtonState.DOWN) {
            controller.pushButton(button);
        }

        response.writeHead(200, {"Content-Type": "text/html"});
        response.end("OK");
        return;
    } else if (pathname === "press") {
        if (query === undefined || query.button === undefined) {
            response.writeHead(400, {"Content-Type": "text/html"});
            response.end("Bad request. Must include 'button' in query string!");
            return;
        }

        let time = 200;
        if (query.time !== undefined) {
            const parsedTime = parseInt(query.time as string, 10);
            if (parsedTime)
                time = parsedTime;
        }

        const button = parseInt(query.button as string, 10);
        if (ButtonType[button] === undefined) {
            response.writeHead(400, {"Content-Type": "text/html"});
            response.end("Bad request. Unknown button " + query.button);
            return;
        }

        controller.pushButton(button);
        setTimeout(() => controller.releaseButton(button), time);

        response.writeHead(200, {"Content-Type": "text/html"});
        response.end("OK");
        return;
    } else if (pathname === "listTargets") {
        const targets = controller.targetConfigurations;

        response.writeHead(200, {"Content-Type": "application/json"});
        response.end(JSON.stringify(targets, undefined, 4));
        return;
    } else if (pathname === "setActive") {
        if (query === undefined || query.active === undefined) {
            response.writeHead(400, {"Content-Type": "text/html"});
            response.end("Bad request. Must include 'active' in query string!");
            return;
        }

        const str = (query.active as string).toLowerCase();
        controller.active = str === "true" || str === "1";
        response.writeHead(200, {"Content-Type": "text/html"});
        response.end("OK");
        return;
    } else if (pathname === "getActive") {
        response.writeHead(200, {"Content-Type": "text/html"});
        response.end(controller.active? "true": "false");
        return;
    } else {
        response.writeHead(404, {"Content-Type": "text/html"});
        response.end("Not Found. No path found for " + pathname);
        return;
    }
}).listen(8080);
