KNX\_Dimmers\_accfactory
========================

This is a factory for accessory that supports KNX switching.
For ease of use, it accepts an ESF export file (known as OPC export) from ETS 4

Preparation in ETS
------------------
These export files represent a KNX *group address structure* which is loosely associated with the devices.

-  Devices can listen to multiple addresses
-  Devices can use different addresses for accepting a WRITE event and broadcasting their state (German Rückmeldeobject - translation needed!)

To generate a device oriented file, I used the following rules to configure my lights in ETS:

1. The switching address (write, EIS 1 - 1 bit telegram) for a device has a plain vanilla name
   Example "Kitchen ceiling light" with group address 1/1/1
2. The broadcasting addresses the device uses to return its status get the switching address at the  end of their names.
   Example "Kitchen ceiling light return 1/1/1" with group address 1/1/3
3. If the device is a dimmer, it has usually at least 2 group addresses: one for switching (see number 1) and one for setting the brightness (EIS 6 - 8 bit telegram)
   The group address used for setting the brightness gets the switching group address at the end of its name, with a upper case letter "B" attached: "Kitchen ceiling light brightness 1/1/1B" with address 1/1/2 
4. If there is a broadcasting address for publishing the current brightness it gets the group address for setting the brightness attached (no B!)
  Example "Kitchen ceiling light brightness broadcasting 1/1/2" with group address 1/1/4
  
Export your project with the OPC export function. It creates the .esf file needed

After exporting 
---------------  

Sadly, the OPC export creates the file in ANSI encoding, for which I haven't found a way to read properly with umlauts etc. I used the free notepad++ text editor to convert my files to UTF-8.

Put your export file into the accessories folder.
In KNX\_Dimmers\_factory, change filename and row filter in the module.exports section at the end of the file.
