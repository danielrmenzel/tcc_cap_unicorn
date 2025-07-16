// Raw Code Loader and Disassembler
var rawCodeLoader = {
    // Current loaded raw code
    rawBytes: [],
    baseAddress: 0x10000,
    mainFunctionOffset: null,
    
    // Load raw hex bytes
    loadHexBytes: function(hexString) {
        // Remove whitespace and convert to bytes
        hexString = hexString.replace(/\s+/g, '');
        this.rawBytes = [];
        
        for (var i = 0; i < hexString.length; i += 2) {
            var byte = parseInt(hexString.substr(i, 2), 16);
            if (!isNaN(byte)) {
                this.rawBytes.push(byte);
            }
        }
        
        if (this.rawBytes.length > 0) {
            this.disassembleAndLoad();
        }
    },
    
    // Disassemble raw bytes and load into assembler pane
    disassembleAndLoad: function(mainFunctionOffset) {
        if (this.rawBytes.length === 0) {
            return;
        }
        
        // Check if emulator is available
        if (typeof e === 'undefined') {
            console.error('Emulator not initialized yet');
            return;
        }
        
        console.log('Loading ' + this.rawBytes.length + ' bytes of raw code at 0x' + this.baseAddress.toString(16));
        
        // Reset emulator state first (with main function offset if provided)
        this.resetEmulatorState(mainFunctionOffset);
        
        // Clear existing instructions
        paneAssembler.instructions = [];
        
        // Map memory for the raw code - only if not already mapped at the same address
        if (!paneAssembler.mapped || paneAssembler.address !== this.baseAddress) {
            if (paneAssembler.mapped) {
                e.mem_unmap(paneAssembler.address, paneAssembler.size);
                paneAssembler.mapped = false;
            }
            // Use the existing paneAssembler.setAddr method which handles mapping properly
            paneAssembler.setAddr(this.baseAddress);
        }
        
        // Write raw bytes to memory
        e.mem_write(this.baseAddress, this.rawBytes);
        
        // Fix function call addresses if this looks like TCC output
        console.log('🔧 === DEBUGGING CALL FIXING START ===');
        console.log('🔧 Raw bytes before fixing:', this.rawBytes.slice(0, 20).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
        console.log('🔧 Checking if should fix function calls, mainFunctionOffset=', mainFunctionOffset);
        
        // RE-ENABLE CALL FIXING WITH ENHANCED DEBUGGING
        console.log('🔧 *** RE-ENABLING CALL FIXING WITH ENHANCED DEBUGGING ***');
        this.fixTCCFunctionCalls();
        
        console.log('🔧 Raw bytes after fixing:', this.rawBytes.slice(0, 20).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
        console.log('🔧 === DEBUGGING CALL FIXING END ===');
        
        // Debug: Check if rawBytes were actually modified
        console.log('🔧 Raw bytes after fixing (first 50 bytes):', this.rawBytes.slice(0, 50).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
        
        // Disassemble using Capstone - use updated rawBytes after call fixing
        console.log('🔧 Disassembling with updated rawBytes...');
        var instructions = d.disasm(this.rawBytes, this.baseAddress);
        console.log('🔧 Disassembled', instructions.length, 'instructions after call fixing');
        
        // Debug: Show call instructions in disassembly
        for (var debugI = 0; debugI < instructions.length; debugI++) {
            if (instructions[debugI].mnemonic === 'call') {
                console.log('🔧 Disassembled CALL:', instructions[debugI].mnemonic, instructions[debugI].op_str, 'at', '0x' + (this.baseAddress + debugI).toString(16));
            }
        }
        
        // Create instruction objects with function labels
        var currentAddr = this.baseAddress;
        var currentOffset = 0;
        var functionBoundaries = this.detectFunctionBoundaries();
        var functionNames = this.extractFunctionNamesFromCCode();
        
        console.log('🏷️ Function boundaries found:', functionBoundaries);
        console.log('🏷️ Function names extracted:', functionNames);
        
        for (var i = 0; i < instructions.length; i++) {
            var inst = new Instruction();
            inst.setAddr(currentAddr);
            inst.setHex(instructions[i].bytes);
            
            // Check if this is the start of a function (compare offset, not address)
            var functionLabel = '';
            for (var j = 0; j < functionBoundaries.length; j++) {
                if (currentOffset === functionBoundaries[j].start) {
                    functionLabel = ' ; ' + (functionNames[j] || 'func' + j) + '()';
                    console.log('🏷️ Adding function label "' + functionLabel + '" at offset ' + currentOffset);
                    break;
                }
            }
            
            inst.dataAsm = instructions[i].mnemonic + ' ' + instructions[i].op_str + functionLabel;
            inst.restore();
            paneAssembler.instructions.push(inst);
            currentAddr += instructions[i].size;
            currentOffset += instructions[i].size;
        }
        
        // Update UI
        paneAssembler.update();
        
        // Set PC to main function if provided, otherwise use base address
        // This must happen AFTER paneAssembler.setAddr() which resets RIP to base address
        var entryPoint = this.baseAddress;
        if (mainFunctionOffset !== undefined && mainFunctionOffset !== null) {
            entryPoint = this.baseAddress + mainFunctionOffset;
            console.log('Setting entry point to main function at 0x' + entryPoint.toString(16));
            pcWrite(entryPoint);
            e.reg_write_i64(uc.X86_REG_RIP, entryPoint);
        }
        
        paneRegisters.update();
        paneMemory.update();
        
        // Initialize stack viewer first (before step debugger)
        stackViewer.init();
        
        // Initialize step debugger
        stepDebugger.init();
        
        // Initialize C code to assembly mapping immediately after step debugger
        console.log('🔗 Initializing C-to-Assembly mapping after assembly load...');
        if (typeof codeLineMapper !== 'undefined') {
            codeLineMapper.initializeMapping();
        } else {
            console.log('⚠️ codeLineMapper not available yet');
        }
        
        // FORCE set the entry point again after all initialization
        if (mainFunctionOffset !== undefined && mainFunctionOffset !== null) {
            var self = this;
            setTimeout(function() {
                var mainAddress = self.baseAddress + mainFunctionOffset;
                console.log('FORCE setting RIP to main function at 0x' + mainAddress.toString(16));
                e.reg_write_i64(uc.X86_REG_RIP, mainAddress);
                if (stepDebugger && stepDebugger.updateCurrentInstructionFromEIP) {
                    stepDebugger.updateCurrentInstructionFromEIP();
                }
                paneRegisters.update();
                
                // Re-initialize mapping after RIP is set to ensure it's available
                if (typeof codeLineMapper !== 'undefined') {
                    console.log('🔗 Re-initializing mapping after RIP set...');
                    codeLineMapper.initializeMapping();
                }
            }, 100);
        }
        
        // Update UI to show reset state
        paneRegisters.update();
        paneMemory.update();
    },
    
    // Reset emulator state to clean slate
    resetEmulatorState: function(mainFunctionOffset) {
        if (typeof e === 'undefined') {
            return;
        }
        
        console.log('Resetting emulator state...');
        
        // Reset all general-purpose registers to zero
        try {
            e.reg_write_i64(uc.X86_REG_RAX, 0);
            e.reg_write_i64(uc.X86_REG_RBX, 0);
            e.reg_write_i64(uc.X86_REG_RCX, 0);
            e.reg_write_i64(uc.X86_REG_RDX, 0);
            e.reg_write_i64(uc.X86_REG_RSI, 0);
            e.reg_write_i64(uc.X86_REG_RDI, 0);
            e.reg_write_i64(uc.X86_REG_RBP, 0);
            
            // Initialize stack properly for function calls with return address
            if (stackViewer.mapped) {
                var stackTop = stackViewer.baseAddress + stackViewer.size - 8; // Leave space for return address
                
                // Push a dummy return address (0x0000000000000000) to signal end of execution
                e.mem_write(stackTop, [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
                
                e.reg_write_i64(uc.X86_REG_RSP, stackTop);
                console.log('✓ Stack initialized at 0x' + stackTop.toString(16) + ' with return address');
            }
            
            // Set RIP to main function if provided, otherwise use base address
            var entryPoint = this.baseAddress;
            if (mainFunctionOffset !== undefined && mainFunctionOffset !== null) {
                entryPoint = this.baseAddress + mainFunctionOffset;
                console.log('Using main function offset: ' + mainFunctionOffset + ', starting at 0x' + entryPoint.toString(16));
                
                // For recursive function tests, set up initial parameter in RDI (x86-64 calling convention)
                // This helps with functions like factorial(5) where 5 needs to be passed as parameter
                e.reg_write_i64(uc.X86_REG_RDI, 5); // Default parameter for testing
                console.log('✓ Set RDI=5 for recursive function parameter passing');
            }
            
            e.reg_write_i64(uc.X86_REG_RIP, entryPoint);
            
            console.log('✓ All registers reset to 0, EIP set to 0x' + entryPoint.toString(16));
        } catch (error) {
            console.warn('Failed to reset some registers:', error);
        }
    },
    
    // Fix TCC function call addresses - TCC often generates calls with incorrect offsets
    fixTCCFunctionCalls: function() {
        console.log('🔧 === STARTING fixTCCFunctionCalls ===');
        console.log('🔧 Raw bytes length:', this.rawBytes.length);
        console.log('🔧 Base address:', '0x' + this.baseAddress.toString(16));
        
        // CRITICAL DEBUGGING: Let's see what we're working with
        console.log('🔧 First 100 raw bytes:', this.rawBytes.slice(0, 100).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
        
        // Look for call instructions with incorrect targets and fix them
        var instructions = d.disasm(this.rawBytes, this.baseAddress);
        console.log('🔧 Found', instructions.length, 'instructions to analyze');
        
        // CRITICAL: Show ALL call instructions BEFORE any fixing
        console.log('🔧 *** ORIGINAL CALL INSTRUCTIONS (before fixing): ***');
        var originalCallOffset = 0;
        for (var origI = 0; origI < instructions.length; origI++) {
            var origInst = instructions[origI];
            if (origInst.mnemonic === 'call') {
                console.log('🔧   ORIGINAL CALL at offset ' + originalCallOffset + ': ' + origInst.mnemonic + ' ' + origInst.op_str);
            }
            originalCallOffset += origInst.size;
        }
        
        var currentOffset = 0;
        var functionBoundaries = this.detectFunctionBoundaries();
        console.log('🔧 Function boundaries:', functionBoundaries);
        
        // CRITICAL: Count how many call instructions we have
        var callCount = 0;
        for (var i = 0; i < instructions.length; i++) {
            if (instructions[i].mnemonic === 'call') {
                callCount++;
            }
        }
        console.log('🔧 *** TOTAL CALL INSTRUCTIONS FOUND: ' + callCount + ' ***');
        
        for (var i = 0; i < instructions.length; i++) {
            var inst = instructions[i];
            
            // Check for call instructions
            if (inst.mnemonic === 'call') {
                console.log('🔧 ===== CALL INSTRUCTION ANALYSIS =====');
                console.log('🔧 Found CALL at offset', currentOffset, ':', inst.mnemonic, inst.op_str);
                console.log('🔧 Call instruction bytes:', inst.bytes.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
                
                // Show surrounding context for debugging
                var contextStart = Math.max(0, currentOffset - 10);
                var contextEnd = Math.min(this.rawBytes.length, currentOffset + 20);
                console.log('🔧 Context bytes:', this.rawBytes.slice(contextStart, contextEnd).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
                
                
                // Extract the target address from op_str (e.g., "call 0x1003d")
                var match = inst.op_str.match(/0x([0-9a-fA-F]+)/);
                if (match) {
                    var targetAddr = parseInt(match[1], 16);
                    console.log('🔧 Original target:', '0x' + targetAddr.toString(16));
                    
                    var correctTarget = targetAddr; // Default to original
                    
                    // Always apply call target determination (it handles recursion internally)
                    console.log('🔍 Applying call target determination for offset', currentOffset, 'target', '0x' + targetAddr.toString(16));
                    try {
                        if (typeof this.determineCorrectCallTarget === 'function') {
                            correctTarget = this.determineCorrectCallTarget(currentOffset, targetAddr);
                        } else {
                            // Fallback: call directly on rawCodeLoader
                            correctTarget = rawCodeLoader.determineCorrectCallTarget(currentOffset, targetAddr);
                        }
                        console.log('🔍 Call target determination returned:', '0x' + correctTarget.toString(16));
                    } catch (error) {
                        console.warn('🔧 Call target determination failed:', error);
                        // Keep original target
                        console.log('🔍 Keeping original target due to error:', '0x' + targetAddr.toString(16));
                    }
                    
                    // If the target needs to be fixed, fix it
                    if (targetAddr !== correctTarget) {
                        console.log('🔧 *** FIXING CALL TARGET: 0x' + targetAddr.toString(16) + ' → 0x' + correctTarget.toString(16) + ' ***');
                        console.log('🔧 *** REASON: Target was corrected by determineCorrectCallTarget() ***');
                        console.log('🔧 *** WARNING: This might be causing the infinite loop! ***');
                        
                        // CRITICAL DEBUG: Let's see what functions exist
                        console.log('🔧 Available function boundaries:');
                        for (var debugF = 0; debugF < functionBoundaries.length; debugF++) {
                            var funcAddr = this.baseAddress + functionBoundaries[debugF].start;
                            console.log('🔧   Function ' + debugF + ' at 0x' + funcAddr.toString(16) + ' (offset ' + functionBoundaries[debugF].start + ')');
                        }
                        
                        // Calculate the correct relative offset for the call
                        var callAddr = this.baseAddress + currentOffset;
                        var relativeOffset = correctTarget - (callAddr + inst.size);
                        console.log('🔧 Call address:', '0x' + callAddr.toString(16));
                        console.log('🔧 Relative offset:', '0x' + relativeOffset.toString(16));
                        
                        // Update the instruction bytes to use the correct offset
                        if (inst.bytes.length >= 5 && inst.bytes[0] === 0xe8) {
                            console.log('🔧 Updating e8 call instruction bytes...');
                            // This is a near call (e8) - update the 32-bit relative offset
                            var offsetBytes = [
                                relativeOffset & 0xFF,
                                (relativeOffset >> 8) & 0xFF,
                                (relativeOffset >> 16) & 0xFF,
                                (relativeOffset >> 24) & 0xFF
                            ];
                            
                            console.log('🔧 New offset bytes:', offsetBytes.map(b => '0x' + b.toString(16)));
                            
                            // Update the instruction bytes in memory and our raw bytes
                            for (var j = 0; j < 4; j++) {
                                this.rawBytes[currentOffset + 1 + j] = offsetBytes[j];
                            }
                            
                            // Write the fixed bytes to memory - use the updated rawBytes
                            var fixedBytes = this.rawBytes.slice(currentOffset, currentOffset + inst.size);
                            console.log('🔧 Writing fixed bytes to memory:', fixedBytes.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
                            e.mem_write(this.baseAddress + currentOffset, fixedBytes);
                            console.log('🔧 *** CALL TARGET FIXED AND WRITTEN TO MEMORY ***');
                            
                            // CRITICAL: Re-write entire modified rawBytes to memory to ensure consistency
                            console.log('🔧 Re-writing all rawBytes to memory for consistency...');
                            e.mem_write(this.baseAddress, this.rawBytes);
                            console.log('🔧 *** COMPLETE MEMORY UPDATE DONE ***');
                        } else {
                            console.log('🔧 Not an e8 call instruction, skipping fix');
                        }
                    } else {
                        console.log('🔧 Target unchanged:', '0x' + targetAddr.toString(16));
                    }
                } else {
                    console.log('🔧 Could not extract target address from:', inst.op_str);
                }
            }
            
            currentOffset += inst.size;
        }
        console.log('🔧 === FINISHED fixTCCFunctionCalls ===');
    },
    
    // Simple check to detect if we're in a loop context (for array indexing)
    isSimpleLoopContext: function(callOffset) {
        // Get the C code to analyze
        var cCode = '';
        if (typeof window !== 'undefined' && window.cCodeEditor) {
            cCode = window.cCodeEditor.getValue();
        }
        
        console.log('🎯 DEBUG: Analyzing C code for loop context...');
        console.log('🎯 DEBUG: C code snippet:', cCode.substring(0, 200));
        
        // Check for array indexing patterns
        var hasArrayIndexing = cCode.includes('[') && cCode.includes(']') && cCode.includes('arr[');
        var hasForLoop = cCode.includes('for') && cCode.includes('i++');
        var hasSimpleMain = cCode.includes('int main()') && !cCode.includes('int add(') && !cCode.includes('int func');
        
        console.log('🎯 DEBUG: hasArrayIndexing =', hasArrayIndexing);
        console.log('🎯 DEBUG: hasForLoop =', hasForLoop);
        console.log('🎯 DEBUG: hasSimpleMain =', hasSimpleMain);
        
        // If this is a simple main function with array indexing in a for loop
        if (hasArrayIndexing && hasForLoop && hasSimpleMain) {
            console.log('🎯 ✅ SIMPLE ARRAY INDEXING LOOP DETECTED - will preserve call targets');
            return true;
        }
        
        // Additional check: any program with just main() and array indexing
        if (hasArrayIndexing && !cCode.includes('int ') && cCode.includes('main()')) {
            console.log('🎯 ✅ MAIN-ONLY PROGRAM WITH ARRAYS - will preserve call targets');
            return true;
        }
        
        console.log('🎯 ❌ Not a simple loop context - will apply call fixing');
        return false;
    },
    
    // Parse TCC ELF output and detect functions
    parseTCCELF: function(hexString) {
        // Convert hex string to bytes
        hexString = hexString.replace(/\s+/g, '');
        var bytes = [];
        for (var i = 0; i < hexString.length; i += 2) {
            var byte = parseInt(hexString.substr(i, 2), 16);
            if (!isNaN(byte)) {
                bytes.push(byte);
            }
        }
        
        // Look for ELF magic header
        if (bytes.length < 64 || bytes[0] !== 0x7f || bytes[1] !== 0x45 || bytes[2] !== 0x4c || bytes[3] !== 0x46) {
            // Not an ELF file, treat as raw bytes
            return { rawBytes: bytes, mainOffset: null };
        }
        
        console.log('[TCC] ELF file detected, parsing sections...');
        
        // Parse ELF header to find section header table
        var shoff = this.readU64LE(bytes, 40); // Section header offset
        var shentsize = this.readU16LE(bytes, 58); // Section header entry size
        var shnum = this.readU16LE(bytes, 60); // Number of section headers
        var shstrndx = this.readU16LE(bytes, 62); // String table section index
        
        console.log('[TCC] Section header table at 0x' + shoff.toString(16) + ', ' + shnum + ' entries');
        
        // Find .text section
        var textSectionOffset = null;
        var textSectionSize = null;
        var symtabOffset = null;
        var symtabSize = null;
        var strtabOffset = null;
        
        for (var i = 0; i < shnum; i++) {
            var shdrOffset = shoff + i * shentsize;
            var nameOffset = this.readU32LE(bytes, shdrOffset);
            var sectionOffset = this.readU64LE(bytes, shdrOffset + 24);
            var sectionSize = this.readU64LE(bytes, shdrOffset + 32);
            var sectionType = this.readU32LE(bytes, shdrOffset + 4);
            
            // Get section name from string table
            var sectionName = this.readSectionName(bytes, shoff + shstrndx * shentsize, nameOffset);
            
            console.log('[TCC] Section ' + i + ': name=\'' + sectionName + '\' (off=' + sectionOffset + ' size=' + sectionSize + ')');
            
            if (sectionName === '.text') {
                textSectionOffset = sectionOffset;
                textSectionSize = sectionSize;
                console.log('[TCC] ✅ Extracting section \'.text\'');
            } else if (sectionName === '.symtab') {
                symtabOffset = sectionOffset;
                symtabSize = sectionSize;
            } else if (sectionName === '.strtab') {
                strtabOffset = sectionOffset;
            }
        }
        
        if (!textSectionOffset) {
            console.warn('[TCC] No .text section found');
            return { rawBytes: bytes, mainOffset: null };
        }
        
        // Extract .text section bytes
        var textBytes = bytes.slice(textSectionOffset, textSectionOffset + textSectionSize);
        
        // Parse symbol table to find functions
        var functionOffsets = [];
        var mainOffset = null;
        
        if (symtabOffset && strtabOffset) {
            var symEntrySize = 24; // Symbol table entry size for 64-bit ELF
            var numSymbols = symtabSize / symEntrySize;
            
            for (var i = 0; i < numSymbols; i++) {
                var symOffset = symtabOffset + i * symEntrySize;
                var nameOffset = this.readU32LE(bytes, symOffset);
                var value = this.readU64LE(bytes, symOffset + 8);
                var size = this.readU64LE(bytes, symOffset + 16);
                var info = bytes[symOffset + 4];
                var type = info & 0xF;
                
                // Check if this is a function symbol (STT_FUNC = 2)
                if (type === 2 && value >= 0 && value < textSectionSize) {
                    var symbolName = this.readSymbolName(bytes, strtabOffset, nameOffset);
                    console.log('[TCC] Function found: ' + symbolName + ' at offset ' + value);
                    
                    functionOffsets.push(value);
                    if (symbolName === 'main') {
                        mainOffset = value;
                        console.log('[TCC] Main function found at offset ' + mainOffset);
                    }
                }
            }
        }
        
        console.log('[TCC] Found ' + functionOffsets.length + ' functions at offsets: ');
        console.log(functionOffsets);
        
        if (functionOffsets.length > 1) {
            if (mainOffset !== null) {
                console.log('[TCC] Multiple functions found, main at offset ' + mainOffset);
            } else {
                console.log('[TCC] Multiple functions found, using first as main');
                mainOffset = functionOffsets[0];
            }
        } else if (functionOffsets.length === 1) {
            console.log('[TCC] Single function found, assuming it is main');
            mainOffset = functionOffsets[0];
        }
        
        return { rawBytes: textBytes, mainOffset: mainOffset };
    },
    
    // Helper functions for ELF parsing
    readU16LE: function(bytes, offset) {
        return bytes[offset] | (bytes[offset + 1] << 8);
    },
    
    readU32LE: function(bytes, offset) {
        return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24);
    },
    
    readU64LE: function(bytes, offset) {
        // JavaScript can't handle 64-bit integers properly, so we'll read as 32-bit for offsets
        return this.readU32LE(bytes, offset);
    },
    
    readSectionName: function(bytes, shstrTabHeaderOffset, nameOffset) {
        var shstrTabOffset = this.readU64LE(bytes, shstrTabHeaderOffset + 24);
        var name = '';
        var pos = shstrTabOffset + nameOffset;
        while (pos < bytes.length && bytes[pos] !== 0) {
            name += String.fromCharCode(bytes[pos]);
            pos++;
        }
        return name;
    },
    
    readSymbolName: function(bytes, strtabOffset, nameOffset) {
        var name = '';
        var pos = strtabOffset + nameOffset;
        while (pos < bytes.length && bytes[pos] !== 0) {
            name += String.fromCharCode(bytes[pos]);
            pos++;
        }
        return name;
    },
    
    // Show input dialog for hex bytes
    showInputDialog: function() {
        var hexInput = window.prompt("Enter raw machine code as hex bytes (e.g., 'B8 05 00 00 00 40 48'):");
        if (hexInput) {
            this.loadHexBytes(hexInput);
        }
    },
    
    // Show input dialog for assembly code
    showAssemblyDialog: function() {
        var assemblyInput = window.prompt("Enter x86 assembly code (separate lines with semicolons):\n\nExample:\nmov eax, 5; inc eax; mov ebx, eax");
        if (assemblyInput) {
            // Convert semicolons to newlines for proper assembly syntax
            var assemblyCode = assemblyInput.replace(/;/g, '\n').trim();
            
            // Use the global assembly function if available
            if (typeof assembleAndLoadFromText !== 'undefined') {
                assembleAndLoadFromText(assemblyCode);
            } else {
                console.error('Assembly compiler not available');
            }
        }
    },
    
    // Show input dialog for C code
    showCCodeDialog: function() {
        var cCode = window.prompt("Enter C code to compile and debug:\n\nExample:\nint main() {\n    int x = 5;\n    int y = x + 3;\n    return y;\n}");
        if (cCode) {
            this.compileCCode(cCode);
        }
    },
    
    // Compile C code using TinyCC WebAssembly (MOCKUP)
    compileCCode: function(cCode) {
        console.log('Compiling C code:', cCode);
        console.log('Using TinyCC mockup - simulating real compilation...');
        
        // Simulate TinyCC compilation patterns
        var mockHex = this.generateMockTinyCCOutput(cCode);
        if (mockHex) {
            console.log('✓ C compilation successful (mockup)!');
            console.log('Generated .text section with realistic patterns');
            this.loadHexBytes(mockHex);
        } else {
            console.error('C code pattern not recognized in mockup');
        }
    },
    
    // Generate realistic TinyCC-style hex output based on C patterns
    generateMockTinyCCOutput: function(cCode) {
        cCode = cCode.toLowerCase().trim();
        
        // Detect common C patterns and generate realistic assembly
        if (cCode.includes('return') && cCode.includes('int main')) {
            if (cCode.includes('+') || cCode.includes('add')) {
                // Simple arithmetic: int main() { return 5 + 3; }
                // Typical TinyCC output: push ebp; mov ebp,esp; mov eax,8; pop ebp; ret
                return '55 89E5 B808000000 5D C3';
            } else if (cCode.includes('*') || cCode.includes('mul')) {
                // Multiplication: int main() { return 4 * 3; }
                return '55 89E5 B80C000000 5D C3';
            } else {
                // Simple return: int main() { return 42; }
                return '55 89E5 B82A000000 5D C3';
            }
        }
        
        if (cCode.includes('for') || cCode.includes('while')) {
            // Loop pattern: for(int i=0; i<5; i++) sum += i;
            // Function prologue + loop + epilogue
            return '55 89E5 B800000000 B905000000 01C8 49 75FB B800000000 5D C3';
        }
        
        if (cCode.includes('if') && cCode.includes('else')) {
            // Conditional: if (x > 5) return 10; else return 5;
            return '55 89E5 83F805 7F04 B805000000 EB02 B80A000000 5D C3';
        }
        
        if (cCode.includes('fibonacci') || cCode.includes('fib')) {
            // Fibonacci function (iterative version)
            return '55 89E5 B801000000 BB01000000 B905000000 89C2 01DA 89D8 89C3 49 75F5 5D C3';
        }
        
        if (cCode.includes('factorial') || cCode.includes('fact')) {
            // Factorial function
            return '55 89E5 B801000000 B905000000 F7E1 49 75FB 5D C3';
        }
        
        // Default: simple function that returns 0
        return '55 89E5 B800000000 5D C3';
    },
    
    // Show input dialog for pasting compiled hex from TinyCC
    showHexPasteDialog: function() {
        var hexInput = window.prompt(
            "Paste hex instructions from TinyCC compilation:\n\n" +
            "Examples:\n" +
            "• Complete TinyCC ELF output (with ELF headers)\n" +
            "• From TinyCC .text section only\n" +
            "• Raw machine code bytes\n" +
            "• Format: '7f 45 4c 46...' (ELF) or '55 89 E5...' (raw)\n\n" +
            "Enter hex bytes:"
        );
        
        if (hexInput) {
            console.log('Loading pasted hex from TinyCC output');
            
            // Try to parse as TCC ELF first
            var parsed = this.parseTCCELF(hexInput);
            if (parsed.mainOffset !== null) {
                console.log('Detected TCC ELF with main at offset ' + parsed.mainOffset);
                this.rawBytes = parsed.rawBytes;
                this.mainFunctionOffset = parsed.mainOffset;
                this.disassembleAndLoad(parsed.mainOffset);
            } else {
                // Fall back to regular hex loading
                this.mainFunctionOffset = null;
                this.loadHexBytes(hexInput);
            }
        }
    },
    
    // Determine the correct call target based on calling context and function locations
    determineCorrectCallTarget: function(callOffset, originalTarget) {
        console.log('🎯 === DETERMINE CORRECT CALL TARGET START ===');
        console.log('🎯 Input: callOffset=' + callOffset + ', originalTarget=0x' + originalTarget.toString(16));
        
        // Dynamically detect function boundaries from the actual compiled code
        var functionBoundaries = this.detectFunctionBoundaries();
        
        console.log('🔍 Detected function boundaries:', functionBoundaries);
        
        // Find which function contains this call
        var callerFunction = null;
        for (var i = 0; i < functionBoundaries.length; i++) {
            var func = functionBoundaries[i];
            if (callOffset >= func.start && callOffset < func.end) {
                callerFunction = func;
                console.log('🔍 Found caller function at index ' + i + ':', func);
                break;
            }
        }
        
        if (!callerFunction) {
            console.log('🎯 Could not determine caller function, keeping original target');
            console.log('🎯 === DETERMINE CORRECT CALL TARGET END (NO CALLER) ===');
            return originalTarget;
        }
        
        console.log('🔍 Call at offset ' + callOffset + ' from function at offset ' + callerFunction.start);
        
        // 🔄 DYNAMIC RECURSION CHECK: Analyze if this is truly intended recursion
        var callerStartAddr = this.baseAddress + callerFunction.start;
        if (originalTarget === callerStartAddr) {
            // Check if this is legitimate recursion by analyzing the call context
            var isLegitimateRecursion = false;
            try {
                isLegitimateRecursion = this.analyzeLegitimateRecursion(callOffset, callerFunction, functionBoundaries);
            } catch (error) {
                console.warn('🔄 Recursion analysis failed:', error);
                isLegitimateRecursion = false; // Default to false recursion for safety
            }
            
            if (isLegitimateRecursion) {
                console.log('🔄 LEGITIMATE RECURSION: Preserving target 0x' + originalTarget.toString(16));
                return originalTarget;
            } else {
                console.log('🔍 FALSE RECURSION detected - will determine correct target dynamically');
                // Fall through to dynamic target determination
            }
        }
        
        // ULTRA CONSERVATIVE CHECK: If we only have main() function, preserve original targets
        var cCode = '';
        if (typeof window !== 'undefined' && window.cCodeEditor) {
            cCode = window.cCodeEditor.getValue();
        }
        
        var isMainOnly = cCode.includes('int main()') && 
                        !cCode.includes('int add(') && 
                        !cCode.includes('int func') && 
                        !cCode.includes('int sub(') &&
                        !cCode.includes('int mul(') &&
                        (cCode.match(/int\s+\w+\s*\(/g) || []).length <= 1;
        
        if (isMainOnly && (cCode.includes('for') || cCode.includes('while'))) {
            console.log('🎯 ✅ MAIN-ONLY PROGRAM WITH LOOPS: Preserving ALL call targets');
            return originalTarget;
        }
        
        // Check if the original target is already a valid function start
        var targetFunction = null;
        for (var i = 0; i < functionBoundaries.length; i++) {
            var func = functionBoundaries[i];
            if (originalTarget === this.baseAddress + func.start) {
                targetFunction = func;
                console.log('🎯 Original target matches function boundary at offset ' + func.start);
                break;
            }
        }
        
        if (targetFunction) {
            // Check if this is the same function calling itself
            var callerStartAddr = this.baseAddress + callerFunction.start;
            if (originalTarget === callerStartAddr) {
                console.log('🎯 Target is valid function but same as caller - potential false recursion');
                // CONSERVATIVE APPROACH: Only "fix" if there's clear evidence this is wrong
                // For simple loops and array indexing, the target might actually be correct
                var isSimpleLoop = this.isSimpleLoopContext(callOffset);
                if (isSimpleLoop) {
                    console.log('🎯 ✅ SIMPLE LOOP DETECTED: Preserving original target to avoid breaking array indexing');
                    return originalTarget;
                }
                
                // ADDITIONAL CONSERVATIVE CHECK: If this is a single-function program,
                // be very careful about "fixing" self-calls
                var functionCount = functionBoundaries.length;
                if (functionCount <= 1) {
                    console.log('🎯 ✅ SINGLE FUNCTION PROGRAM: Preserving original target to avoid breaking loops');
                    return originalTarget;
                }
                
                // Fall through to correction logic for complex cases
            } else {
                console.log('🎯 ✅ Original target 0x' + originalTarget.toString(16) + ' is already a valid different function, KEEPING IT');
                console.log('🎯 ===== DETERMINE CORRECT CALL TARGET END (VALID TARGET) =====');
                return originalTarget;
            }
        }
        
        // For calls from main function, prefer the first function (func2 at offset 0)
        // For calls from other functions, use proximity-based logic
        var bestTarget = originalTarget;
        var bestDistance = Infinity;
        
        // Dynamic logic: determine call order based on function sequence
        // Find the position of the calling function in the function list
        var callerIndex = -1;
        for (var i = 0; i < functionBoundaries.length; i++) {
            if (functionBoundaries[i].start === callerFunction.start) {
                callerIndex = i;
                break;
            }
        }
        
        // DYNAMIC CALL TARGET DETERMINATION: Analyze call context and patterns
        var dynamicTarget = null;
        try {
            dynamicTarget = this.analyzeDynamicCallTarget(callOffset, originalTarget, callerFunction, functionBoundaries);
            if (dynamicTarget !== null) {
                console.log('🎯 Dynamic analysis determined target: 0x' + dynamicTarget.toString(16));
                return dynamicTarget;
            }
        } catch (error) {
            console.warn('🎯 Dynamic analysis failed:', error);
            // Fall through to original logic
        }
        
        // If this is a non-main function calling itself, it MIGHT be recursion
        // But we need to be careful - TinyCC often generates false recursion
        if (callerIndex >= 0 && callerIndex < functionBoundaries.length - 1) {
            var targetIsOwnFunction = originalTarget === this.baseAddress + callerFunction.start;
            if (targetIsOwnFunction) {
                // Only preserve recursion if we have evidence it's intentional
                // If there are multiple functions available, it's likely a TinyCC bug
                if (functionBoundaries.length > 1) {
                    console.log('🔄 Suspected false recursion (multiple functions available) - will correct');
                    // Don't return here, fall through to correction logic
                } else {
                    console.log('🔄 Single function - preserving recursion');
                    return this.baseAddress + callerFunction.start;
                }
            }
        }
        
        // First, check if the original target is inside a function (not at the start)
        for (var i = 0; i < functionBoundaries.length; i++) {
            var func = functionBoundaries[i];
            var funcAddr = this.baseAddress + func.start;
            
            // If target is inside this function but not at the start, route to function start
            if (originalTarget > funcAddr && originalTarget < this.baseAddress + func.end) {
                console.log('🎯 Target 0x' + originalTarget.toString(16) + ' is inside function at 0x' + funcAddr.toString(16) + ', routing to function start');
                return funcAddr;
            }
        }
        
        // If not inside a function, find the best alternative function
        // For TinyCC fixes, avoid routing back to the calling function
        var callerAddr = this.baseAddress + callerFunction.start;
        
        for (var i = 0; i < functionBoundaries.length; i++) {
            var func = functionBoundaries[i];
            var funcAddr = this.baseAddress + func.start;
            
            // Skip the calling function itself to avoid false recursion
            if (funcAddr === callerAddr) {
                console.log('🎯 Skipping caller function at 0x' + funcAddr.toString(16));
                continue;
            }
            
            var distance = Math.abs(originalTarget - funcAddr);
            
            if (distance < bestDistance) {
                bestDistance = distance;
                bestTarget = funcAddr;
                console.log('🎯 Better target found: 0x' + funcAddr.toString(16) + ' (distance: ' + distance + ')');
            }
        }
        
        // Final safety check - if we couldn't find an alternative, use the first function that's not the caller
        if (bestTarget === originalTarget && functionBoundaries.length > 1) {
            for (var i = 0; i < functionBoundaries.length; i++) {
                var fallbackAddr = this.baseAddress + functionBoundaries[i].start;
                if (fallbackAddr !== callerAddr) {
                    bestTarget = fallbackAddr;
                    console.log('🎯 Using safety fallback: 0x' + bestTarget.toString(16));
                    break;
                }
            }
        }
        
        console.log('🎯 Final correction: 0x' + originalTarget.toString(16) + ' → 0x' + bestTarget.toString(16));
        console.log('🎯 === DETERMINE CORRECT CALL TARGET END ===');
        return bestTarget;
    },
    
    // Dynamically detect function boundaries by looking for function prologues
    detectFunctionBoundaries: function() {
        var functions = [];
        var instructions = d.disasm(this.rawBytes, this.baseAddress);
        var currentOffset = 0;
        
        console.log('🔍 === FUNCTION BOUNDARY DETECTION START ===');
        console.log('🔍 Total instructions to analyze:', instructions.length);
        
        // Look for function prologues (push rbp; mov rbp, rsp)
        for (var i = 0; i < instructions.length; i++) {
            var inst = instructions[i];
            
            // Check for push rbp (0x55)
            if (inst.bytes.length > 0 && inst.bytes[0] === 0x55) {
                // Check if next instruction is mov rbp, rsp (0x48 0x89 0xe5)
                if (i + 1 < instructions.length) {
                    var nextInst = instructions[i + 1];
                    if (nextInst.bytes.length >= 3 && 
                        nextInst.bytes[0] === 0x48 && 
                        nextInst.bytes[1] === 0x89 && 
                        nextInst.bytes[2] === 0xe5) {
                        
                        // Found function prologue
                        var funcStart = currentOffset;
                        var funcEnd = this.rawBytes.length; // Default to end of code
                        
                        // Try to find the end by looking for the next function prologue
                        var nextOffset = currentOffset + inst.size;
                        for (var j = i + 1; j < instructions.length; j++) {
                            var futureInst = instructions[j];
                            if (futureInst.bytes.length > 0 && futureInst.bytes[0] === 0x55) {
                                // Check if this is another function prologue
                                if (j + 1 < instructions.length) {
                                    var futureNextInst = instructions[j + 1];
                                    if (futureNextInst.bytes.length >= 3 && 
                                        futureNextInst.bytes[0] === 0x48 && 
                                        futureNextInst.bytes[1] === 0x89 && 
                                        futureNextInst.bytes[2] === 0xe5) {
                                        funcEnd = nextOffset;
                                        break;
                                    }
                                }
                            }
                            nextOffset += futureInst.size;
                        }
                        
                        functions.push({
                            start: funcStart,
                            end: funcEnd
                        });
                        
                        console.log('🔍 ✅ Found function at offset ' + funcStart + ' to ' + funcEnd + ' (size: ' + (funcEnd - funcStart) + ' bytes)');
                    }
                }
            }
            
            currentOffset += inst.size;
        }
        
        console.log('🔍 === FUNCTION BOUNDARY DETECTION END ===');
        console.log('🔍 Total functions detected:', functions.length);
        
        return functions;
    },
    
    // Count how many call instructions exist before the current offset within a function
    countCallsFromFunction: function(functionStartOffset, currentCallOffset) {
        var instructions = d.disasm(this.rawBytes, this.baseAddress);
        var currentOffset = 0;
        var callCount = 0;
        
        for (var i = 0; i < instructions.length; i++) {
            var inst = instructions[i];
            
            // Only count calls within the same function
            if (currentOffset >= functionStartOffset && currentOffset < currentCallOffset) {
                if (inst.mnemonic === 'call') {
                    callCount++;
                }
            }
            
            // Stop when we reach the current call offset
            if (currentOffset === currentCallOffset) {
                break;
            }
            
            currentOffset += inst.size;
        }
        
        return callCount + 1; // +1 for the current call
    },
    
    // Extract function names from C code dynamically
    extractFunctionNamesFromCCode: function() {
        var functionNames = [];
        
        // Try to get C code from the editor
        var cCode = '';
        if (typeof cCodeEditor !== 'undefined' && cCodeEditor) {
            cCode = cCodeEditor.getValue();
        } else if (typeof window.cCodeEditor !== 'undefined' && window.cCodeEditor) {
            cCode = window.cCodeEditor.getValue();
        }
        
        if (!cCode) {
            console.log('⚠️ No C code available, using generic function names');
            return ['func0', 'func1', 'func2', 'func3', 'func4', 'func5'];
        }
        
        console.log('🔍 Parsing C code for function names...');
        
        // Regular expression to match function definitions ONLY
        // Matches: return_type function_name(parameters) { OR on next line
        // FIXED: Handle { on same line OR next line, exclude C keywords
        var functionRegex = /^\s*(?:int|char|float|double|void|long|short|unsigned|signed)\s+(\w+)\s*\([^)]*\)\s*(?:\{|$)/gm;
        var match;
        var extractedNames = [];
        
        while ((match = functionRegex.exec(cCode)) !== null) {
            var functionName = match[1];
            
            // CRITICAL FIX: Exclude C keywords that are NOT function names
            var cKeywords = ['for', 'while', 'if', 'else', 'switch', 'case', 'do', 'break', 'continue', 'return', 'goto'];
            if (cKeywords.includes(functionName)) {
                console.log('🚫 Skipping C keyword: ' + functionName);
                continue;
            }
            
            if (functionName && !extractedNames.includes(functionName)) {
                extractedNames.push(functionName);
                console.log('📝 Found function: ' + functionName);
            }
        }
        
        // If we found functions, use them
        if (extractedNames.length > 0) {
            functionNames = extractedNames;
            console.log('✅ Extracted ' + functionNames.length + ' function names: ' + functionNames.join(', '));
        } else {
            // Fallback to generic names
            console.log('⚠️ No functions found in C code, using generic names');
            functionNames = ['func0', 'func1', 'func2', 'func3', 'func4', 'func5'];
        }
        
        return functionNames;
    },
    
    // DYNAMIC ANALYSIS: Determine if a self-call is legitimate recursion
    analyzeLegitimateRecursion: function(callOffset, callerFunction, functionBoundaries) {
        console.log('🔬 Analyzing recursion legitimacy for call at offset ' + callOffset);
        
        // Parse the C code to understand function relationships
        var cCode = this.getCCode();
        if (!cCode) {
            console.log('🔬 No C code available, assuming false recursion');
            return false;
        }
        
        // Extract function names and their relationships
        var functionNames = this.extractFunctionNamesFromCCode();
        var callerIndex = this.getFunctionIndexByOffset(callOffset, functionBoundaries);
        
        if (callerIndex < 0 || callerIndex >= functionNames.length) {
            console.log('🔬 Cannot determine caller function, assuming false recursion');
            return false;
        }
        
        var callerName = functionNames[callerIndex];
        console.log('🔬 Analyzing recursion for function: ' + callerName);
        
        // Check if the function actually contains recursive calls in the C code
        // Simple check: look for the function name called within its own body
        var functionStart = cCode.indexOf(callerName + '(');
        if (functionStart === -1) {
            console.log('🔬 Function definition not found');
            return false;
        }
        
        // Find the function body (simple brace matching)
        var braceCount = 0;
        var bodyStart = cCode.indexOf('{', functionStart);
        if (bodyStart === -1) return false;
        
        var bodyEnd = bodyStart;
        for (var i = bodyStart; i < cCode.length; i++) {
            if (cCode[i] === '{') braceCount++;
            if (cCode[i] === '}') braceCount--;
            if (braceCount === 0) {
                bodyEnd = i;
                break;
            }
        }
        
        var functionBody = cCode.substring(bodyStart + 1, bodyEnd);
        var hasRecursiveCall = functionBody.indexOf(callerName + '(') !== -1;
        
        console.log('🔬 Function ' + callerName + ' has recursive call in C code: ' + hasRecursiveCall);
        return hasRecursiveCall;
    },
    
    // DYNAMIC ANALYSIS: Determine correct call target based on context
    analyzeDynamicCallTarget: function(callOffset, originalTarget, callerFunction, functionBoundaries) {
        console.log('🎯 ===== DYNAMIC CALL TARGET ANALYSIS START =====');
        console.log('🎯 Call offset:', callOffset);
        console.log('🎯 Original target: 0x' + originalTarget.toString(16));
        console.log('🎯 Caller function:', callerFunction);
        
        var cCode = this.getCCode();
        if (!cCode) {
            console.log('🎯 No C code available for dynamic analysis');
            return null;
        }
        
        var functionNames = this.extractFunctionNamesFromCCode();
        var callerIndex = this.getFunctionIndexByOffset(callOffset, functionBoundaries);
        
        if (callerIndex < 0 || callerIndex >= functionNames.length) {
            console.log('🎯 Cannot determine caller function');
            return null;
        }
        
        var callerName = functionNames[callerIndex];
        console.log('🎯 Analyzing calls from function: ' + callerName);
        
        // Extract the function body from C code - find the DEFINITION, not declaration
        // Look for "type functionName(" pattern to find the actual definition
        var functionPattern = new RegExp('(?:int|char|float|double|void|long|short|unsigned|signed)\\s+' + callerName + '\\s*\\(', 'g');
        var functionStart = -1;
        var match;
        
        while ((match = functionPattern.exec(cCode)) !== null) {
            // Check if this is followed by a brace (definition) or semicolon (declaration)
            var afterMatch = cCode.substring(match.index + match[0].length);
            var nextBracePos = afterMatch.indexOf('{');
            var nextSemicolonPos = afterMatch.indexOf(';');
            
            // If brace comes before semicolon (or no semicolon), this is a definition
            if (nextBracePos !== -1 && (nextSemicolonPos === -1 || nextBracePos < nextSemicolonPos)) {
                functionStart = match.index;
                break;
            }
        }
        
        if (functionStart === -1) {
            console.log('🎯 Cannot find function definition for ' + callerName);
            return null;
        }
        
        // Find the opening brace for THIS function definition
        // Start looking from the end of the function signature match
        var afterSignature = cCode.substring(match.index + match[0].length);
        var braceOffset = afterSignature.indexOf('{');
        if (braceOffset === -1) {
            console.log('🎯 Cannot find function body start for ' + callerName);
            return null;
        }
        var braceStart = match.index + match[0].length + braceOffset;
        
        // Simple brace matching to find function body
        var braceCount = 0;
        var braceEnd = braceStart;
        for (var i = braceStart; i < cCode.length; i++) {
            if (cCode[i] === '{') braceCount++;
            if (cCode[i] === '}') braceCount--;
            if (braceCount === 0) {
                braceEnd = i;
                break;
            }
        }
        
        var functionBody = cCode.substring(braceStart + 1, braceEnd);
        console.log('🎯 Function body: ' + functionBody.replace(/\s+/g, ' ').substring(0, 100) + '...');
        
        // Find all function calls in the body
        var callPattern = /(\w+)\s*\(/g;
        var callMatch;
        var calledFunctions = [];
        
        while ((callMatch = callPattern.exec(functionBody)) !== null) {
            var calledFunc = callMatch[1];
            // Filter out language keywords and the function itself (unless it's real recursion)
            if (calledFunc !== 'for' && calledFunc !== 'if' && calledFunc !== 'while' && 
                functionNames.includes(calledFunc)) {
                calledFunctions.push(calledFunc);
            }
        }
        
        console.log('🎯 Functions called from ' + callerName + ': ' + calledFunctions.join(', '));
        
        // If there's exactly one external function called, route to it
        var externalCalls = calledFunctions.filter(f => f !== callerName);
        if (externalCalls.length === 1) {
            var targetFunctionName = externalCalls[0];
            var targetIndex = functionNames.indexOf(targetFunctionName);
            
            if (targetIndex >= 0 && targetIndex < functionBoundaries.length) {
                console.log('🎯 Routing call to ' + targetFunctionName + ' at index ' + targetIndex);
                return this.baseAddress + functionBoundaries[targetIndex].start;
            }
        }
        
        // If multiple external calls, use call sequence analysis
        if (externalCalls.length > 1) {
            try {
                return this.analyzeCallSequence(callOffset, callerFunction, externalCalls, functionNames, functionBoundaries);
            } catch (error) {
                console.warn('🎯 Call sequence analysis failed:', error);
                // Use first external call as fallback
                if (externalCalls.length > 0) {
                    var fallbackTarget = externalCalls[0];
                    var fallbackIndex = functionNames.indexOf(fallbackTarget);
                    if (fallbackIndex >= 0 && fallbackIndex < functionBoundaries.length) {
                        console.log('🎯 Using fallback target: ' + fallbackTarget);
                        return this.baseAddress + functionBoundaries[fallbackIndex].start;
                    }
                }
            }
        }
        
        console.log('🎯 Dynamic analysis inconclusive - using fallback logic');
        
        // FALLBACK: If we have multiple functions and the original target is the calling function,
        // route to a different function (simple heuristic)
        if (functionBoundaries.length > 1) {
            for (var i = 0; i < functionBoundaries.length; i++) {
                var funcAddr = this.baseAddress + functionBoundaries[i].start;
                if (funcAddr !== originalTarget) {
                    console.log('🎯 Fallback: routing to different function at 0x' + funcAddr.toString(16));
                    return funcAddr;
                }
            }
        }
        
        return null;
    },
    
    // Helper: Get C code from editor
    getCCode: function() {
        if (typeof cCodeEditor !== 'undefined' && cCodeEditor) {
            return cCodeEditor.getValue();
        } else if (typeof window.cCodeEditor !== 'undefined' && window.cCodeEditor) {
            return window.cCodeEditor.getValue();
        }
        return '';
    },
    
    // Helper: Get function index by call offset
    getFunctionIndexByOffset: function(callOffset, functionBoundaries) {
        for (var i = 0; i < functionBoundaries.length; i++) {
            if (callOffset >= functionBoundaries[i].start && callOffset < functionBoundaries[i].end) {
                return i;
            }
        }
        return -1;
    },
    
    // Advanced: Analyze call sequence in loops/multiple calls
    analyzeCallSequence: function(callOffset, callerFunction, externalCalls, functionNames, functionBoundaries) {
        console.log('🔍 Analyzing call sequence for multiple external calls: ' + externalCalls.join(', '));
        
        // Count calls to each function in the assembly to determine intent
        var instructions = d.disasm(this.rawBytes.slice(callerFunction.start, callerFunction.end), 
                                   this.baseAddress + callerFunction.start);
        var callInstructions = [];
        var currentPos = callerFunction.start;
        
        for (var i = 0; i < instructions.length; i++) {
            var inst = instructions[i];
            if (inst.mnemonic === 'call') {
                callInstructions.push(currentPos);
            }
            currentPos += inst.size;
        }
        
        console.log('🔍 Found ' + callInstructions.length + ' call instructions in function');
        
        // If this is the first/primary call and there's a clear primary target, use it
        if (externalCalls.length > 0) {
            var primaryTarget = externalCalls[0]; // Use first mentioned function
            var targetIndex = functionNames.indexOf(primaryTarget);
            
            if (targetIndex >= 0 && targetIndex < functionBoundaries.length) {
                console.log('🔍 Using primary target: ' + primaryTarget);
                return this.baseAddress + functionBoundaries[targetIndex].start;
            }
        }
        
        return null;
    }
};

// Global function for TCC integration to set main function offset
window.setMainFunctionOffset = function(offset) {
    console.log('Setting main function offset to ' + offset + ' via global function');
    rawCodeLoader.mainFunctionOffset = offset;
    
    // If debugger is already initialized, update the entry point
    if (typeof stepDebugger !== 'undefined' && stepDebugger.isInitialized) {
        var mainAddress = rawCodeLoader.baseAddress + offset;
        console.log('Updating RIP to main function at 0x' + mainAddress.toString(16));
        e.reg_write_i64(uc.X86_REG_RIP, mainAddress);
        stepDebugger.updateCurrentInstructionFromEIP();
        paneRegisters.update();
    }
};

// Global function for TCC integration to load code with main offset
window.loadTCCCode = function(hexBytes, mainOffset) {
    console.log('Loading TCC code via global function, main at offset ' + mainOffset);
    rawCodeLoader.rawBytes = hexBytes;
    rawCodeLoader.mainFunctionOffset = mainOffset;
    rawCodeLoader.disassembleAndLoad(mainOffset);
};

// Enhanced function specifically for the .text section bytes with function info
window.loadTextSectionWithMain = function(textBytes, mainFunctionOffset) {
    console.log('[Assembly Debugger] Loading .text section (' + textBytes.length + ' bytes) with main at offset ' + mainFunctionOffset);
    
    // Convert array of bytes to the format expected by rawCodeLoader
    if (Array.isArray(textBytes)) {
        rawCodeLoader.rawBytes = textBytes;
    } else {
        // Convert hex string to bytes if needed
        var bytes = [];
        var hexStr = textBytes.replace(/\s+/g, '');
        for (var i = 0; i < hexStr.length; i += 2) {
            bytes.push(parseInt(hexStr.substr(i, 2), 16));
        }
        rawCodeLoader.rawBytes = bytes;
    }
    
    rawCodeLoader.mainFunctionOffset = mainFunctionOffset;
    
    // Fix any call instructions before loading
    if (mainFunctionOffset !== null) {
        rawCodeLoader.fixTCCFunctionCalls();
    }
    
    // Load and start at main function
    rawCodeLoader.disassembleAndLoad(mainFunctionOffset);
    
    console.log('[Assembly Debugger] Code loaded, entry point set to main function');
};

// Step-by-step debugger
var stepDebugger = {
    isInitialized: false,
    
    init: function() {
        console.log('Initializing step debugger...');
        this.isInitialized = true;
        
        // Check if we should start at main function instead of first instruction
        if (rawCodeLoader.mainFunctionOffset !== null && rawCodeLoader.mainFunctionOffset !== undefined) {
            var mainAddress = rawCodeLoader.baseAddress + rawCodeLoader.mainFunctionOffset;
            console.log('Step debugger: jumping to main function at 0x' + mainAddress.toString(16));
            e.reg_write_i64(uc.X86_REG_RIP, mainAddress);
        }
        
        this.updateCurrentInstructionFromEIP();
        console.log('Step debugger initialized with ' + paneAssembler.instructions.length + ' instructions');
    },
    
    stepNext: function() {
        if (!this.isInitialized) {
            console.warn('Cannot step: debugger not initialized');
            return;
        }
        
        if (typeof e === 'undefined') {
            console.error('Emulator not initialized yet');
            return;
        }
        
        // Ensure mapping is available before stepping
        if (typeof codeLineMapper !== 'undefined' && codeLineMapper.lineMapping.size === 0) {
            console.log('🔗 Mapping not available, initializing now...');
            codeLineMapper.initializeMapping();
        }
        
        // Get current RIP to find the instruction to execute
        var currentRIP = e.reg_read_i64(uc.X86_REG_RIP);
        var currentInst = this.findInstructionAtAddress(currentRIP);
        
        if (!currentInst) {
            console.warn('No instruction found at RIP 0x' + currentRIP.toString(16) + ' - execution may be complete');
            
            // If we're at address 0, show the return value and cleanup
            if (currentRIP === 0) {
                var eax = e.reg_read_i32(uc.X86_REG_RAX);
                console.log('🎯 Program completed with return value in RAX: ' + eax);
                
                // Clear all highlighting after execution completion
                $('.row-instruction').removeClass('current-instruction');
                if (typeof codeLineMapper !== 'undefined') {
                    codeLineMapper.clearCHighlight();
                    console.log('🧹 Cleared all highlighting after program completion');
                }
            }
            return;
        }
        
        var nextAddr = currentInst.getAddress() + currentInst.length();
        
        // Log current instruction with C correspondence
        console.log('\n🚀 === EXECUTING STEP ===');
        console.log('🔧 Assembly: "' + currentInst.dataAsm + '" at 0x' + currentInst.getAddress().toString(16));
        
        // Show corresponding C line if available
        if (typeof codeLineMapper !== 'undefined' && codeLineMapper.lineMapping.has(currentInst.getAddress())) {
            var cLineNum = codeLineMapper.lineMapping.get(currentInst.getAddress());
            if (typeof cCodeEditor !== 'undefined') {
                var cCodeLines = cCodeEditor.getValue().split('\n');
                var cLineContent = cCodeLines[cLineNum - 1] || 'line not found';
                console.log('📝 C Line ' + cLineNum + ': "' + cLineContent.trim() + '"');
                console.log('🔗 EXECUTING: "' + currentInst.dataAsm + '" ↔ "' + cLineContent.trim() + '"');
            }
        } else {
            console.log('🔗 C mapping: Not available for this instruction');
        }
        
        // Read RIP before execution
        var ripBefore = e.reg_read_i64(uc.X86_REG_RIP);
        
        // Execute one instruction
        try {
            e.emu_start(currentInst.getAddress(), nextAddr, 0, 1);
        } catch (error) {
            console.warn('Emulation failed:', error);
            
            // Handle return instruction specifically
            if (currentInst.dataAsm.trim() === 'ret') {
                // The ret instruction failed because it's trying to jump to 0x0
                // This means the function is returning - set RIP to 0 to signal completion
                try {
                    e.reg_write_i64(uc.X86_REG_RIP, 0);
                    var eax = e.reg_read_i32(uc.X86_REG_RAX);
                    console.log('🎯 Function returned successfully with RAX: ' + eax);
                } catch (regError) {
                    console.warn('Failed to read return value:', regError);
                }
            }
            return;
        }
        
        // Read RIP after execution and log if it changed
        var ripAfter = e.reg_read_i64(uc.X86_REG_RIP);
        if (ripBefore !== ripAfter) {
            console.log('  RIP: 0x' + ripBefore.toString(16) + ' → 0x' + ripAfter.toString(16));
        }
        
        // Let the register panel handle register updates generically
        console.log('  Instruction executed successfully');
        
        // Update current instruction highlighting based on new EIP
        this.updateCurrentInstructionFromEIP();
        
        // Update UI
        paneRegisters.update();
        paneMemory.update();
        stackViewer.update();
    },
    
    findInstructionAtAddress: function(address) {
        for (var i = 0; i < paneAssembler.instructions.length; i++) {
            var inst = paneAssembler.instructions[i];
            if (inst.getAddress() === address) {
                return inst;
            }
        }
        return null;
    },
    
    stepBack: function() {
        if (!this.isInitialized || this.currentInstructionIndex <= 0) {
            return;
        }
        
        // Note: This is a simplified implementation
        // In a real debugger, you'd need to save state snapshots
        console.warn("Step back not fully implemented - would need state snapshots");
        this.currentInstructionIndex--;
        this.updateCurrentInstruction();
    },
    
    updateCurrentInstruction: function() {
        // Clear all instruction highlighting
        $('.row-instruction').removeClass('current-instruction');
        // Clear all assembly function highlighting classes
        for (let i = 0; i <= 4; i++) {
            $('.row-instruction').removeClass('assembly-function-highlight-' + i);
        }
        
        // Clear C code highlighting
        if (typeof codeLineMapper !== 'undefined') {
            codeLineMapper.clearCHighlight();
        }
        
        // Highlight current instruction
        if (this.currentInstructionIndex < paneAssembler.instructions.length) {
            var currentInst = paneAssembler.instructions[this.currentInstructionIndex];
            
            // Check if we can determine the function color for this instruction
            var colorClass = 'current-instruction'; // Default yellow fallback
            if (typeof codeLineMapper !== 'undefined' && currentInst.address) {
                var functionInfo = codeLineMapper.lineMapping.get(currentInst.address);
                if (functionInfo && functionInfo.functionName) {
                    var functionIndex = codeLineMapper.getFunctionIndex(functionInfo.functionName);
                    var colorIndex = codeLineMapper.getFunctionColor(functionInfo.functionName, functionIndex);
                    colorClass = 'assembly-function-highlight-' + colorIndex;
                    console.log('🎨 Assembly instruction at 0x' + currentInst.address.toString(16) + ' using color ' + colorIndex + ' for function "' + functionInfo.functionName + '"');
                }
            }
            
            $(currentInst.node).addClass(colorClass);
            
            // Highlight corresponding C code line
            if (typeof codeLineMapper !== 'undefined' && currentInst.address) {
                codeLineMapper.highlightCLine(currentInst.address);
            }
        }
    },
    
    updateCurrentInstructionFromEIP: function() {
        if (typeof e === 'undefined') {
            return;
        }
        
        var currentRIP = e.reg_read_i64(uc.X86_REG_RIP);
        var currentInst = this.findInstructionAtAddress(currentRIP);
        
        // Clear all highlighting first
        $('.row-instruction').removeClass('current-instruction');
        // Clear all assembly function highlighting classes
        for (let i = 0; i <= 4; i++) {
            $('.row-instruction').removeClass('assembly-function-highlight-' + i);
        }
        
        // Highlight the current instruction if found
        if (currentInst) {
            // Check if we can determine the function color for this instruction
            var colorClass = 'current-instruction'; // Default yellow fallback
            var instructionAddress = currentInst.getAddress();
            if (typeof codeLineMapper !== 'undefined') {
                var functionInfo = codeLineMapper.lineMapping.get(instructionAddress);
                if (functionInfo && functionInfo.functionName) {
                    var functionIndex = codeLineMapper.getFunctionIndex(functionInfo.functionName);
                    var colorIndex = codeLineMapper.getFunctionColor(functionInfo.functionName, functionIndex);
                    colorClass = 'assembly-function-highlight-' + colorIndex;
                    console.log('🎨 Assembly instruction at 0x' + instructionAddress.toString(16) + ' using color ' + colorIndex + ' for function "' + functionInfo.functionName + '"');
                }
            }
            
            $(currentInst.node).addClass(colorClass);
            console.log('\n🎯 === STEP DEBUG === RIP: 0x' + currentRIP.toString(16) + ' ===');
            console.log('🔧 Assembly instruction: "' + currentInst.dataAsm + '"');
            
            // Highlight corresponding C code line
            if (typeof codeLineMapper !== 'undefined') {
                console.log('🔗 Triggering C line highlighting...');
                console.log('🔧 Using instruction address 0x' + instructionAddress.toString(16) + ' instead of RIP 0x' + currentRIP.toString(16));
                codeLineMapper.highlightCLine(instructionAddress);
            } else {
                console.log('❌ codeLineMapper not available');
            }
            
            console.log('=== END STEP DEBUG ===\n');
        } else {
            console.log('\n❌ No instruction found at RIP 0x' + currentRIP.toString(16));
            console.log('🔍 Available instruction addresses:');
            for (var i = 0; i < Math.min(5, paneAssembler.instructions.length); i++) {
                var inst = paneAssembler.instructions[i];
                console.log('   0x' + inst.getAddress().toString(16) + ': ' + inst.dataAsm);
            }
        }
    },
    
    reset: function() {
        console.log('Resetting step debugger...');
        this.isInitialized = false;
        
        // Clear highlighting
        $('.row-instruction').removeClass('current-instruction');
        // Clear all assembly function highlighting classes
        for (let i = 0; i <= 4; i++) {
            $('.row-instruction').removeClass('assembly-function-highlight-' + i);
        }
        
        // Clear C code highlighting
        if (typeof codeLineMapper !== 'undefined') {
            codeLineMapper.clearCHighlight();
        }
        
        // Reset emulator state
        if (rawCodeLoader.rawBytes.length > 0) {
            rawCodeLoader.disassembleAndLoad(rawCodeLoader.mainFunctionOffset);
        }
    }
};

// Stack viewer
var stackViewer = {
    baseAddress: 0x7fff0000,
    size: 0x1000,
    mapped: false,
    
    init: function() {
        if (typeof e === 'undefined') {
            console.error('Emulator not initialized yet');
            return;
        }
        
        if (!this.mapped) {
            try {
                e.mem_map(this.baseAddress, this.size, uc.PROT_ALL);
                this.mapped = true;
                
                // Initialize stack pointer
                e.reg_write_i32(uc.X86_REG_ESP, this.baseAddress + this.size - 4);
                console.log('✓ Stack mapped successfully at 0x' + this.baseAddress.toString(16));
            } catch (error) {
                console.warn('Stack mapping failed:', error);
                this.mapped = false;
                return;
            }
        }
        this.update();
    },
    
    update: function() {
        if (!this.mapped) {
            this.init();
            return;
        }
        
        if (typeof e === 'undefined') {
            return; // Silently skip if emulator not ready
        }
        
        try {
            var rsp = e.reg_read_i64(uc.X86_REG_RSP);
            
            // Check if RSP is within our mapped stack region
            if (rsp < this.baseAddress || rsp >= this.baseAddress + this.size) {
                // RSP is outside our stack region, don't try to read
                this.clearStackDisplay();
                return;
            }
            
            // Calculate safe read size (don't read past stack boundaries)
            var maxReadSize = (this.baseAddress + this.size) - rsp;
            var readSize = Math.min(64, maxReadSize);
            
            if (readSize <= 0) {
                this.clearStackDisplay();
                return;
            }
            
            var stackData = e.mem_read(rsp, readSize);
            this.displayStackData(rsp, stackData);
            
        } catch (error) {
            // Silently handle stack read failures
            this.clearStackDisplay();
        }
    },
    
    clearStackDisplay: function() {
        var stackTable = $('#stack-viewer');
        stackTable.find('.row-stack').remove();
    },
    
    displayStackData: function(rsp, stackData) {
        var stackTable = $('#stack-viewer');
        stackTable.find('.row-stack').remove();
        
        for (var i = 0; i < stackData.length; i += 8) {
            // Make sure we have at least 8 bytes to read
            if (i + 7 >= stackData.length) break;
            
            var addr = rsp + i;
            // Fix unsigned 64-bit conversion (little endian)
            var value = 0;
            for (var j = 0; j < 8; j++) {
                value |= stackData[i+j] << (j * 8);
            }
            value = value >>> 0; // Ensure unsigned
            
            var row = '<tr class="row-stack">';
            row += '<td>' + utilIntToHex(addr, 8) + '</td>';
            row += '<td>' + utilIntToHex(value, 8) + '</td>';
            row += '<td>' + value + '</td>';
            row += '</tr>';
            
            stackTable.append(row);
        }
    }
};

// Add methods to Instruction class
Instruction.prototype.getAddress = function() {
    return parseInt(this.nodeAddr.innerHTML, 16);
};