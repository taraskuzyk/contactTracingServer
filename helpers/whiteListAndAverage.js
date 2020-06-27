module.exports = function whiteListAndAverage(data,whiteList){
    return beaconsAverageRSSI(whiteListBeaconsFromUplink(data, whiteList))
}

function beaconsAverageRSSI(beacons){
    var beaconsAvg = []
    for (var i = 0; i < beacons.length; i++){
        if (beaconsAvg.length === 0) {
            beacons[i].sum = beacons[i].rssi;
            beacons[i].count = 1;
            beacons[i].avg = beacons[i].rssi;
            beaconsAvg.push(beacons[i])
        } else {
            var beaconFound = false;
            for (var j = 0; j < beaconsAvg.length; j++){

                if (beaconsAvg[j].id === beacons[i].id){
                    beaconsAvg[j].sum += beacons[i].rssi;
                    beaconsAvg[j].count += 1;
                    beaconsAvg[j].avg = beaconsAvg[j].sum/beaconsAvg[j].count;
                    beaconFound = true;
                    break;
                }
            }
            if (beaconFound === false){
                beacons[i].sum = beacons[i].rssi;
                beacons[i].count = 1;
                beacons[i].avg = beacons[i].rssi;
                beaconsAvg.push(beacons[i]);
            }
        }
    }
    return beaconsAvg
}

function whiteListBeaconsFromUplink(msg, white_list){
    var beacons = [];

    if (msg.hasOwnProperty('detected_devices')){
        msg.detected_devices = JSON.parse(msg.detected_devices);
        for (var i = 0; i < msg.detected_devices.length; i++) {
            for (var j = 0; j < white_list.length; j++){
                if (white_list[j].mac === msg.detected_devices[i].id) {
                    beacons.push(msg.detected_devices[i])
                }
            }
        }
    }
    for (var k = 0; k<4; k++) {
        if (msg.hasOwnProperty('detected_devices_range_'+k)) {
            let detected_devices = JSON.parse(msg['detected_devices_range_'+k]);
            for (var i = 0; i < detected_devices.length; i++) {
                for (var j = 0; j < white_list.length; j++) {

                    if (white_list[j].mac.slice(6, 12).toUpperCase() === detected_devices[i].id.toUpperCase()) {
                        detected_devices[i].mac = white_list[j].mac.toUpperCase();
                        beacons.push(detected_devices[i])
                    }
                }
            }
        }
    }
    //console.log(beacons)
    return beacons;
}
