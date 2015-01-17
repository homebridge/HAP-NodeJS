exports.encodeTLV = function (type,data) {
    
    var encodedTLVBuffer = Buffer(0);
    
    if (data.length <= 255) {
        encodedTLVBuffer = Buffer.concat([Buffer([type,data.length]),data]);
    } else {
        var leftLength = data.length;
        var tempBuffer = Buffer(0);
        var currentStart = 0;
        
        for (; leftLength > 0;) {
            if (leftLength >= 255) {
                tempBuffer = Buffer.concat([tempBuffer,Buffer([type,0xFF]),data.slice(currentStart, currentStart + 255)]);
                leftLength -= 255;
                currentStart = currentStart + 255;
            } else {
                tempBuffer = Buffer.concat([tempBuffer,Buffer([type,leftLength]),data.slice(currentStart, currentStart + leftLength)]);
                leftLength -= leftLength;
            }
        };
        
        encodedTLVBuffer = tempBuffer;
    }
    
    return encodedTLVBuffer;
}

exports.decodeTLV = function (data) {
    
    var objects = {};
    
    var leftLength = data.length;
    var currentIndex = 0;
    
    for (; leftLength > 0;) {
        var type = data[currentIndex]
        var length = data[currentIndex+1]
        currentIndex += 2;
        leftLength -= 2;
        
        var newData = data.slice(currentIndex, currentIndex+length);
        
        if (objects[type]) {
            objects[type] = Buffer.concat([objects[type],newData]);
        } else {
            objects[type] = newData;
        }
        
        currentIndex += length;
        leftLength -= length;
    };
    
    return objects;
}