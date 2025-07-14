var e = new uc.Unicorn(uc.ARCH_X86, uc.MODE_64);
var a = new ks.Keystone(ks.ARCH_X86, ks.MODE_64);
var d = new cs.Capstone(cs.ARCH_X86, cs.MODE_64);

// Instruction Pointer
function pcRead() {
    return e.reg_read_i64(uc.X86_REG_RIP);
}
function pcWrite(value) {
    return e.reg_write_i64(uc.X86_REG_RIP, value);
}

// Customization
$('title').html('Assembly Debugger: X86');
$('.navbar-demo').html('X86 Raw Code Analyzer');

// Registers (64-bit mode with 32-bit register views)
paneRegisters.add(new Register('RAX',  'i64', uc.X86_REG_RAX));
paneRegisters.add(new Register('RBX',  'i64', uc.X86_REG_RBX));
paneRegisters.add(new Register('RCX',  'i64', uc.X86_REG_RCX));
paneRegisters.add(new Register('RDX',  'i64', uc.X86_REG_RDX));
paneRegisters.add(new Register('RBP',  'i64', uc.X86_REG_RBP));
paneRegisters.add(new Register('RSP',  'i64', uc.X86_REG_RSP));
paneRegisters.add(new Register('RSI',  'i64', uc.X86_REG_RSI));
paneRegisters.add(new Register('RDI',  'i64', uc.X86_REG_RDI));
paneRegisters.add(new Register('RIP',  'i64', uc.X86_REG_RIP));
paneRegisters.update();

// Initialization - Load sample raw code
paneAssembler.setAddr(0x10000);

// Initialize stack if stackViewer is available
if (typeof stackViewer !== 'undefined') {
    stackViewer.init();
}

// No hardcoded examples - use the toolbar buttons to load your own code
console.log('Ready! Use the toolbar buttons to load assembly code or hex bytes.');
console.log('Assembly button: Enter assembly like "mov eax, 5; inc eax"');
console.log('Hex button: Enter hex bytes like "B8 05 00 00 00 40"');
console.log('Paste button: Enter multi-line assembly code');
paneMemory.update();
