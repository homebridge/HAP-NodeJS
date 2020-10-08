// manually created

import { Access, Characteristic, Formats, Perms } from '../Characteristic';
import { Service } from '../Service';


/**
 * Characteristic "Target Control Supported Configuration"
 */

export class TargetControlSupportedConfiguration extends Characteristic {

    static readonly UUID: string = '00000123-0000-1000-8000-0026BB765291';

    constructor() {
        super('Target Control Supported Configuration', TargetControlSupportedConfiguration.UUID, {
            format: Formats.TLV8,
            perms: [Perms.PAIRED_READ]
        });
        this.value = this.getDefaultValue();
    }
}

Characteristic.TargetControlSupportedConfiguration = TargetControlSupportedConfiguration;

/**
 * Characteristic "Target Control List"
 */

export class TargetControlList extends Characteristic {

    static readonly UUID: string = '00000124-0000-1000-8000-0026BB765291';

    constructor() {
        super('Target Control List', TargetControlList.UUID, {
            format: Formats.TLV8,
            perms: [Perms.PAIRED_WRITE, Perms.PAIRED_READ, Perms.WRITE_RESPONSE],
            adminOnlyAccess: [Access.READ, Access.WRITE],
        });
        this.value = this.getDefaultValue();
    }

}

Characteristic.TargetControlList = TargetControlList;

/**
 * Characteristic "Button Event"
 */

export class ButtonEvent extends Characteristic {

    static readonly UUID: string = '00000126-0000-1000-8000-0026BB765291';

    constructor() {
        super('Button Event', ButtonEvent.UUID, {
            format: Formats.TLV8,
            perms: [Perms.PAIRED_READ, Perms.NOTIFY],
            adminOnlyAccess: [Access.NOTIFY],
        });
        this.value = this.getDefaultValue();
    }

}

Characteristic.ButtonEvent = ButtonEvent;

/**
 * Characteristic "Selected Audio Stream Configuration"
 */

export class SelectedAudioStreamConfiguration extends Characteristic {

    static readonly UUID: string = '00000128-0000-1000-8000-0026BB765291';

    constructor() {
        super('Selected Audio Stream Configuration', SelectedAudioStreamConfiguration.UUID, {
            format: Formats.TLV8,
            perms: [Perms.PAIRED_READ, Perms.PAIRED_WRITE]
        });
        this.value = this.getDefaultValue();
    }

}

Characteristic.SelectedAudioStreamConfiguration = SelectedAudioStreamConfiguration;

/**
 * Characteristic "Siri Input Type"
 */

export class SiriInputType extends Characteristic {

    static readonly PUSH_BUTTON_TRIGGERED_APPLE_TV = 0;

    static readonly UUID: string = '00000132-0000-1000-8000-0026BB765291';

    constructor() {
        super('Siri Input Type', SiriInputType.UUID, {
            format: Formats.UINT8,
            minValue: 0,
            maxValue: 0,
            validValues: [0],
            perms: [Perms.PAIRED_READ]
        });
        this.value = this.getDefaultValue();
    }

}

Characteristic.SiriInputType = SiriInputType;

/**
 * Service "Target Control Management"
 */

export class TargetControlManagement extends Service {

    static readonly UUID: string = '00000122-0000-1000-8000-0026BB765291';

    constructor(displayName: string, subtype: string) {
        super(displayName, TargetControlManagement.UUID, subtype);

        // Required Characteristics
        this.addCharacteristic(Characteristic.TargetControlSupportedConfiguration);
        this.addCharacteristic(Characteristic.TargetControlList);
    }
}

Service.TargetControlManagement = TargetControlManagement;

/**
 * Service "Target Control"
 */

export class TargetControl extends Service {

    static readonly UUID: string = '00000125-0000-1000-8000-0026BB765291';

    constructor(displayName: string, subtype: string) {
        super(displayName, TargetControl.UUID, subtype);

        // Required Characteristics
        this.addCharacteristic(Characteristic.ActiveIdentifier);
        this.addCharacteristic(Characteristic.Active);
        this.addCharacteristic(Characteristic.ButtonEvent);

        // Optional Characteristics
        this.addOptionalCharacteristic(Characteristic.Name);
    }
}

Service.TargetControl = TargetControl;

/**
 * Service "Audio Stream Management"
 */

export class AudioStreamManagement extends Service {

    static readonly UUID: string = '00000127-0000-1000-8000-0026BB765291';

    constructor(displayName: string, subtype: string) {
        super(displayName, AudioStreamManagement.UUID, subtype);

        // Required Characteristics
        this.addCharacteristic(Characteristic.SupportedAudioStreamConfiguration);
        this.addCharacteristic(Characteristic.SelectedAudioStreamConfiguration);
    }
}

Service.AudioStreamManagement = AudioStreamManagement;

/**
 * Service "Siri"
 */

export class Siri extends Service {

    static readonly UUID: string = '00000133-0000-1000-8000-0026BB765291';

    constructor(displayName: string, subtype: string) {
        super(displayName, Siri.UUID, subtype);

        // Required Characteristics
        this.addCharacteristic(Characteristic.SiriInputType);
    }
}

Service.Siri = Siri;
