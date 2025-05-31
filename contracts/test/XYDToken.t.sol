// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/XYDToken.sol";

contract XYDTokenTest is Test {
    XYDToken public xydToken;
    address public owner;
    address public user1;
    address public user2;

    function setUp() public {
        owner = address(this);
        user1 = address(0x1);
        user2 = address(0x2);
        
        xydToken = new XYDToken();
    }

    function testInitialState() public view {
        assertEq(xydToken.name(), "XYD Token");
        assertEq(xydToken.symbol(), "XYD");
        assertEq(xydToken.decimals(), 18);
        assertEq(xydToken.totalSupply(), 1_000_000 * 10**18);
        assertEq(xydToken.balanceOf(owner), 1_000_000 * 10**18);
        assertEq(xydToken.owner(), owner);
    }

    function testGetTokenInfo() public view {
        (string memory name, string memory symbol, uint8 decimals, uint256 totalSupply) = xydToken.getTokenInfo();
        
        assertEq(name, "XYD Token");
        assertEq(symbol, "XYD");
        assertEq(decimals, 18);
        assertEq(totalSupply, 1_000_000 * 10**18);
    }

    function testTransfer() public {
        uint256 transferAmount = 1000 * 10**18;
        
        xydToken.transfer(user1, transferAmount);
        
        assertEq(xydToken.balanceOf(user1), transferAmount);
        assertEq(xydToken.balanceOf(owner), 1_000_000 * 10**18 - transferAmount);
    }

    function testMint() public {
        uint256 mintAmount = 5000 * 10**18;
        uint256 initialSupply = xydToken.totalSupply();
        
        xydToken.mint(user1, mintAmount);
        
        assertEq(xydToken.balanceOf(user1), mintAmount);
        assertEq(xydToken.totalSupply(), initialSupply + mintAmount);
    }

    function testMintOnlyOwner() public {
        uint256 mintAmount = 5000 * 10**18;
        
        vm.prank(user1);
        vm.expectRevert();
        xydToken.mint(user2, mintAmount);
    }

    function testBurn() public {
        uint256 burnAmount = 1000 * 10**18;
        uint256 initialSupply = xydToken.totalSupply();
        uint256 initialBalance = xydToken.balanceOf(owner);
        
        xydToken.burn(burnAmount);
        
        assertEq(xydToken.balanceOf(owner), initialBalance - burnAmount);
        assertEq(xydToken.totalSupply(), initialSupply - burnAmount);
    }

    function testBatchTransfer() public {
        address[] memory recipients = new address[](2);
        uint256[] memory amounts = new uint256[](2);
        
        recipients[0] = user1;
        recipients[1] = user2;
        amounts[0] = 1000 * 10**18;
        amounts[1] = 2000 * 10**18;
        
        xydToken.batchTransfer(recipients, amounts);
        
        assertEq(xydToken.balanceOf(user1), 1000 * 10**18);
        assertEq(xydToken.balanceOf(user2), 2000 * 10**18);
    }

    function testBatchTransferArrayMismatch() public {
        address[] memory recipients = new address[](2);
        uint256[] memory amounts = new uint256[](1);
        
        recipients[0] = user1;
        recipients[1] = user2;
        amounts[0] = 1000 * 10**18;
        
        vm.expectRevert("Arrays length mismatch");
        xydToken.batchTransfer(recipients, amounts);
    }
} 