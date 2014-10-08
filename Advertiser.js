var mdns = require('mdns');

Advertiser.prototype = {
	startAdvertising: function startAdvertising() {
		if (!this._private.isAdvertising) {
			this._private.ad.start();
			this._private.isAdvertising = true;
		}
	},
}

function Advertiser(port, accessory_name, accessory_id, accessory_conf, accessory_state) {
	if (!(this instanceof Advertiser))  {
		return new Advertiser(port, accessory_name, accessory_id, accessory_conf, accessory_state);
	}
	this.targetPort = port;
	this.acc_name = accessory_name;
	this.acc_id = accessory_id;
	this.acc_conf = accessory_conf;
	this.acc_state = accessory_state;
	this._private = {
		isAdvertising: false
	}
	this._private.txt_record = {
	    md: this.acc_name,
	    pv: "1.0",
	    id: this.acc_id,
	    "c#": this.acc_conf,
	    "s#": this.acc_state,
	    sf: "1",
	    "ff": "0"
	};
	this._private.ad = mdns.createAdvertisement(mdns.tcp('hap'), this.targetPort, {name: this.acc_name, txtRecord: this._private.txt_record});
}

module.exports = {
	Advertiser: Advertiser
};